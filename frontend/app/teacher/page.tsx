"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/components/LocaleProvider";
import { createClient } from "@/lib/supabase/client";
import { fetchHeatmap, uploadPdf } from "@/lib/api";
import UserAvatar from "@/components/UserAvatar";
import { useUserRole } from "@/lib/useUserRole";
import { Upload, FileText, Loader2, Plus, Link2, X, Check, ClipboardList, CalendarDays } from "lucide-react";

type Workspace = { id: string; title: string; subject: string; grade: string };
type HeatmapNode = {
  node_id: string;
  failures: number;
  completions: number;
  total_errors: number;
  intensity: number;
};
type MemberRow = {
  student_id: string;
  email: string | null;
  completed: number;
  failed: number;
  errors: number;
};
type AssignmentRow = {
  id: string;
  title: string;
  topic: string;
  deadline: string | null;
  created_at: string;
  done_count: number;
  total_count: number;
};

export default function TeacherPage() {
  const router = useRouter();
  const { t } = useLocale();
  const { role, loading: roleLoading } = useUserRole();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWs, setSelectedWs] = useState<string | null>(null);
  const [heatmap, setHeatmap] = useState<HeatmapNode[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [sources, setSources] = useState<{ id: string; file_name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [newClass, setNewClass] = useState({ title: "", subject: "", grade: "" });
  const [creating, setCreating] = useState(false);

  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [showAssign, setShowAssign] = useState(false);
  const [newAssign, setNewAssign] = useState({ title: "", topic: "", description: "", deadline: "" });
  const [assigning, setAssigning] = useState(false);

  const [copied, setCopied] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const supabase = createClient();

  useEffect(() => {
    if (!roleLoading && role !== "teacher") {
      router.replace("/");
    }
  }, [role, roleLoading, router]);

  const loadWorkspaces = async () => {
    const { data } = await supabase
      .from("workspaces")
      .select("id, title, subject, grade")
      .order("created_at", { ascending: false });
    if (data) {
      setWorkspaces(data);
      if (data.length > 0 && !selectedWs) setSelectedWs(data[0].id);
    }
  };

  useEffect(() => {
    loadWorkspaces();
  }, [supabase]);

  useEffect(() => {
    if (!selectedWs) return;
    setLoading(true);
    setError("");

    fetchHeatmap(selectedWs)
      .then((res) => setHeatmap(res.nodes))
      .catch((err) => setError(err.message || "Failed to load heatmap"));

    supabase
      .from("sources")
      .select("id, file_name")
      .eq("workspace_id", selectedWs)
      .then(({ data }) => setSources(data || []));

    loadAssignments(selectedWs);

    (async () => {
      const { data: memberships } = await supabase
        .from("class_memberships")
        .select("student_id")
        .eq("workspace_id", selectedWs);
      const ids = [...new Set((memberships || []).map((m) => m.student_id))];
      const { data: profiles } = ids.length
        ? await supabase.from("profiles").select("id, email").in("id", ids)
        : { data: [] };
      const emailById = new Map((profiles || []).map((p) => [p.id, p.email]));

      const { data: progress } = await supabase
        .from("student_progress")
        .select("student_id, status, error_count")
        .eq("workspace_id", selectedWs);

      const rows = new Map<string, MemberRow>();
      for (const id of ids) {
        rows.set(id, { student_id: id, email: emailById.get(id) || null, completed: 0, failed: 0, errors: 0 });
      }
      for (const r of progress || []) {
        const row = rows.get(r.student_id);
        if (!row) continue;
        if (r.status === "completed") row.completed += 1;
        else row.failed += 1;
        row.errors += r.error_count || 0;
      }
      setMembers([...rows.values()]);
      setLoading(false);
    })();
  }, [selectedWs, supabase]);

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClass.title) return;
    setCreating(true);
    setError("");
    const { data, error: err } = await supabase
      .from("workspaces")
      .insert({
        title: newClass.title,
        subject: newClass.subject || "General",
        grade: newClass.grade || "",
      })
      .select("id, title, subject, grade")
      .single();
    if (err || !data) {
      setError(err?.message || "Failed to create class");
    } else {
      setWorkspaces((prev) => [data, ...prev]);
      setSelectedWs(data.id);
      setShowCreate(false);
      setNewClass({ title: "", subject: "", grade: "" });
    }
    setCreating(false);
  };

  const shareUrl = typeof window !== "undefined" && selectedWs
    ? `${window.location.origin}/invite?class=${selectedWs}`
    : "";

  const copyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy link");
    }
  };

  const loadAssignments = async (workspaceId: string) => {
    const { data: userId } = await supabase.auth.getUser();
    if (!userId.user) return;
    const { data: rows } = await supabase
      .from("assignments")
      .select("id, title, topic, deadline, created_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });
    const { data: memberships } = await supabase
      .from("class_memberships")
      .select("student_id")
      .eq("workspace_id", workspaceId);
    const total = new Set((memberships || []).map((m) => m.student_id)).size;
    const { data: prog } = rows?.length
      ? await supabase
          .from("assignment_progress")
          .select("assignment_id, status")
          .in("assignment_id", rows.map((r) => r.id))
          .eq("status", "done")
      : { data: [] };
    const doneByAssign = new Map<string, number>();
    for (const p of prog || []) {
      doneByAssign.set(p.assignment_id, (doneByAssign.get(p.assignment_id) || 0) + 1);
    }
    setAssignments(
      (rows || []).map((r) => ({
        ...r,
        done_count: doneByAssign.get(r.id) || 0,
        total_count: total,
      }))
    );
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWs || !newAssign.title || !newAssign.topic) return;
    setAssigning(true);
    setError("");
    const { data: u } = await supabase.auth.getUser();
    const teacherId = u.user?.id;
    if (!teacherId) {
      setError("Not authenticated");
      setAssigning(false);
      return;
    }
    const { error: err } = await supabase.from("assignments").insert({
      workspace_id: selectedWs,
      teacher_id: teacherId,
      title: newAssign.title,
      topic: newAssign.topic,
      description: newAssign.description || null,
      deadline: newAssign.deadline ? new Date(newAssign.deadline).toISOString() : null,
    });
    if (err) {
      setError(err.message || "Failed to create assignment");
    } else {
      setShowAssign(false);
      setNewAssign({ title: "", topic: "", description: "", deadline: "" });
      loadAssignments(selectedWs);
    }
    setAssigning(false);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedWs) return;
    setUploading(true);
    setError("");
    try {
      const res = await uploadPdf(selectedWs, file);
      setSources((prev) => [...prev, { id: res.source_id, file_name: file.name }]);
    } catch (err: any) {
      setError(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const heatIntensity = (i: number) => {
    if (i > 0.7) return "bg-red-100 border-red-300 text-red-900";
    if (i > 0.4) return "bg-orange-100 border-orange-300 text-orange-900";
    if (i > 0.1) return "bg-yellow-100 border-yellow-300 text-yellow-900";
    return "bg-green-100 border-green-300 text-green-900";
  };

  const totalAttempts = members.reduce((a, s) => a + s.completed + s.failed, 0);
  const totalCompleted = members.reduce((a, s) => a + s.completed, 0);
  const successRate = totalAttempts > 0 ? Math.round((totalCompleted / totalAttempts) * 100) : null;

  if (roleLoading || role !== "teacher") {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen">
        <Loader2 size={20} className="animate-spin text-muted" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <header className="flex items-center justify-between px-6 py-3 border-b border-border bg-surface">
        <div>
          <div className="text-sm font-semibold">{t("teacher.mode")}</div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted">
            [ TEACHER_CONSOLE: LIVE ]
          </div>
        </div>
        <UserAvatar />
      </header>

      {error && (
        <div className="border-b border-border bg-surface px-6 py-2.5 text-sm text-red-600 font-mono">
          [ ERROR ] {error}
        </div>
      )}

      <main className="flex-1 p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-3 border border-border divide-y md:divide-y-0 md:divide-x divide-border bg-surface">
            <div className="p-5">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted">[ {t("teacher.classes")} ]</div>
              <div className="text-2xl font-semibold mt-1">{workspaces.length}</div>
            </div>
            <div className="p-5">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted">[ {t("teacher.students")} ]</div>
              <div className="text-2xl font-semibold mt-1">{members.length}</div>
            </div>
            <div className="p-5">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted">[ {t("teacher.successRate")} ]</div>
              <div className="text-2xl font-semibold mt-1">{successRate === null ? "—" : `${successRate}%`}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Class list */}
            <div className="border border-border bg-surface">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted">[ {t("teacher.classes")} ]</span>
                <button
                  onClick={() => setShowCreate(true)}
                  className="flex items-center gap-1 text-xs font-medium hover:text-primary transition-colors"
                >
                  <Plus size={12} /> {t("teacher.new")}
                </button>
              </div>
              {workspaces.length === 0 ? (
                <div className="p-4 text-sm text-muted">{t("teacher.noClasses")}</div>
              ) : (
                <div className="divide-y divide-border">
                  {workspaces.map((ws) => (
                    <button
                      key={ws.id}
                      onClick={() => setSelectedWs(ws.id)}
                      className={`w-full text-left p-4 text-sm transition-colors ${
                        selectedWs === ws.id ? "bg-primary text-foreground" : "hover:bg-surface"
                      }`}
                    >
                      <div className="font-medium">{ws.title}</div>
                      <div className={`text-xs mt-0.5 ${selectedWs === ws.id ? "text-foreground/70" : "text-muted"}`}>
                        {ws.subject} {ws.grade ? `/ Grade ${ws.grade}` : ""}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Upload + share */}
            <div className="md:col-span-2 border border-border bg-surface">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted">[ UPLOAD_MATERIAL ]</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowAssign(true)}
                    disabled={!selectedWs}
                    className="flex items-center gap-1.5 border border-primary/40 bg-primary/10 text-foreground px-3 py-1.5 text-xs font-medium hover:bg-primary/20 transition-colors disabled:opacity-40"
                  >
                    <ClipboardList size={12} /> {t("teacher.assign")}
                  </button>
                  {sources.length > 0 && (
                    <span className="font-mono text-[10px] uppercase text-muted">
                      {sources.length} FILE{sources.length > 1 ? "S" : ""}
                    </span>
                  )}
                </div>
              </div>
              <div className="p-4 space-y-4">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading || !selectedWs}
                  className="w-full border-2 border-dashed border-border p-8 flex flex-col items-center justify-center text-center hover:border-primary transition-colors disabled:opacity-40"
                >
                  {uploading ? (
                    <Loader2 size={20} className="animate-spin text-muted mb-3" />
                  ) : (
                    <Upload size={20} className="text-muted mb-3" />
                  )}
                  <p className="text-sm font-medium">{uploading ? t("teacher.uploading") : t("upload.material")}</p>
                  <p className="text-xs text-muted mt-1 font-mono">PDF · parsed · chunked · embedded</p>
                </button>
                <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden" onChange={handleUpload} />

                {selectedWs && (
                  <div className="border border-border bg-surface p-3 space-y-1.5">
                    <div className="font-mono text-[10px] uppercase tracking-widest text-muted">[ INVITE_STUDENTS ]</div>
                    <div className="text-xs text-muted truncate">{shareUrl}</div>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[11px] text-muted">{t("teacher.inviteLabel")}</p>
                      <button
                        onClick={copyLink}
                        className="flex items-center gap-1.5 border border-border bg-surface px-3 py-1.5 text-xs font-medium hover:border-primary transition-colors flex-shrink-0"
                      >
                        {copied ? <Check size={12} /> : <Link2 size={12} />}
                        {copied ? t("teacher.copied") : t("teacher.copy")}
                      </button>
                    </div>
                  </div>
                )}

                {sources.length > 0 && (
                  <div className="divide-y divide-border border border-border">
                    {sources.map((s, i) => (
                      <div key={s.id} className="flex items-center gap-2 px-3 py-2 text-sm text-muted">
                        <FileText size={13} className="text-muted flex-shrink-0" />
                        <span className="font-mono text-[10px] text-muted">{String(i + 1).padStart(2, "0")}</span>
                        <span className="truncate">{s.file_name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Roster */}
          <div className="border border-border bg-surface overflow-hidden">
            <div className="px-4 py-3 border-b border-border font-mono text-[10px] uppercase tracking-widest text-muted">
              [ CLASS_ROSTER ]
            </div>
            {members.length === 0 ? (
              <div className="p-4 text-sm text-muted">{t("teacher.noStudents")}</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted border-b border-border font-mono uppercase tracking-wider">
                    <th className="px-4 py-2.5 font-medium">{t("teacher.studentCol")}</th>
                    <th className="px-4 py-2.5 font-medium">{t("teacher.completedCol")}</th>
                    <th className="px-4 py-2.5 font-medium">{t("teacher.failedCol")}</th>
                    <th className="px-4 py-2.5 font-medium">{t("teacher.errorsCol")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {members.map((s, i) => (
                    <tr key={i}>
                      <td className="px-4 py-2.5 font-medium">{s.email || s.student_id.slice(0, 8)}</td>
                      <td className="px-4 py-2.5 text-green-700">{s.completed}</td>
                      <td className="px-4 py-2.5 text-red-600">{s.failed}</td>
                      <td className="px-4 py-2.5 text-muted">{s.errors}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Assignments */}
          <div className="border border-border bg-surface overflow-hidden">
            <div className="px-4 py-3 border-b border-border font-mono text-[10px] uppercase tracking-widest text-muted">
              [ {t("teacher.assignList")} ]
            </div>
            {assignments.length === 0 ? (
              <div className="p-4 text-sm text-muted">{t("teacher.noAssignments")}</div>
            ) : (
              <div className="divide-y divide-border">
                {assignments.map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{a.title}</div>
                      <div className="text-xs text-muted truncate">topic: {a.topic}</div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {a.deadline && (
                        <span className="flex items-center gap-1 font-mono text-[10px] uppercase text-muted">
                          <CalendarDays size={11} />
                          {new Date(a.deadline).toLocaleDateString()}
                        </span>
                      )}
                      <span className="font-mono text-[10px] uppercase border border-border px-2 py-0.5 text-muted">
                        {a.done_count}/{a.total_count} {t("teacher.doneOf")}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Heatmap */}
          <div className="border border-border bg-surface">
            <div className="px-4 py-3 border-b border-border font-mono text-[10px] uppercase tracking-widest text-muted">
              [ HEATMAP: STUMBLING NODES ]
            </div>
            {loading ? (
              <div className="flex items-center gap-2 p-6 text-sm text-muted">
                <Loader2 size={14} className="animate-spin" /> {t("teacher.loadingAnalytics")}
              </div>
            ) : heatmap.length === 0 ? (
              <div className="p-6 text-sm text-muted">{t("teacher.noAnalytics")}</div>
            ) : (
              <div className="p-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                {heatmap.map((node) => (
                  <div
                    key={node.node_id}
                    className={`border p-2.5 ${heatIntensity(node.intensity)}`}
                    title={`Failures: ${node.failures} · Errors: ${node.total_errors}`}
                  >
                    <div className="text-xs font-medium truncate">{node.node_id}</div>
                    <div className="font-mono text-[10px] mt-1 opacity-70">F:{node.failures} C:{node.completions}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Create class modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="bg-surface border border-border w-full max-w-md">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted">[ CREATE_CLASS ]</span>
              <button onClick={() => setShowCreate(false)} className="text-muted hover:text-foreground">
                <X size={14} />
              </button>
            </div>
            <form onSubmit={handleCreateClass} className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-muted mb-1">{t("teacher.classTitle")}</label>
                <input
                  value={newClass.title}
                  onChange={(e) => setNewClass({ ...newClass, title: e.target.value })}
                  className="w-full h-10 border border-border px-3 text-sm outline-none focus:border-primary"
                  placeholder={t("teacher.classTitlePh")}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">{t("teacher.subject")}</label>
                  <input
                    value={newClass.subject}
                    onChange={(e) => setNewClass({ ...newClass, subject: e.target.value })}
                    className="w-full h-10 border border-border px-3 text-sm outline-none focus:border-primary"
                    placeholder={t("teacher.subjectPh")}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">{t("teacher.grade")}</label>
                  <input
                    value={newClass.grade}
                    onChange={(e) => setNewClass({ ...newClass, grade: e.target.value })}
                    className="w-full h-10 border border-border px-3 text-sm outline-none focus:border-primary"
                    placeholder={t("teacher.gradePh")}
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={creating}
                className="w-full h-10 bg-primary hover:bg-primary-hover disabled:opacity-40 text-foreground text-sm font-medium transition-colors"
              >
                {creating ? t("teacher.creating") : t("teacher.createClass")}
              </button>
            </form>
          </div>
        </div>
      )}
    {/* Assign homework modal */}
      {showAssign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="bg-surface border border-border w-full max-w-md">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted">[ {t("teacher.assignNew")} ]</span>
              <button onClick={() => setShowAssign(false)} className="text-muted hover:text-foreground">
                <X size={14} />
              </button>
            </div>
            <form onSubmit={handleAssign} className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-muted mb-1">{t("teacher.assignTitle")}</label>
                <input
                  value={newAssign.title}
                  onChange={(e) => setNewAssign({ ...newAssign, title: e.target.value })}
                  className="w-full h-10 border border-border px-3 text-sm outline-none focus:border-primary"
                  placeholder={t("teacher.assignTitlePh")}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted mb-1">{t("teacher.assignTopic")}</label>
                <input
                  value={newAssign.topic}
                  onChange={(e) => setNewAssign({ ...newAssign, topic: e.target.value })}
                  className="w-full h-10 border border-border px-3 text-sm outline-none focus:border-primary"
                  placeholder={t("teacher.assignTopicPh")}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted mb-1">{t("teacher.assignDesc")}</label>
                <input
                  value={newAssign.description}
                  onChange={(e) => setNewAssign({ ...newAssign, description: e.target.value })}
                  className="w-full h-10 border border-border px-3 text-sm outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted mb-1">{t("teacher.assignDeadline")}</label>
                <input
                  type="date"
                  value={newAssign.deadline}
                  onChange={(e) => setNewAssign({ ...newAssign, deadline: e.target.value })}
                  className="w-full h-10 border border-border px-3 text-sm outline-none focus:border-primary"
                />
              </div>
              <button
                type="submit"
                disabled={assigning}
                className="w-full h-10 bg-primary hover:bg-primary-hover disabled:opacity-40 text-foreground text-sm font-medium transition-colors"
              >
                {assigning ? t("teacher.assigning") : t("teacher.assignSubmit")}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
