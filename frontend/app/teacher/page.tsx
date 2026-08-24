"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/components/LocaleProvider";
import { createClient } from "@/lib/supabase/client";
import { fetchClassAnalytics, fetchHeatmap, uploadPdf, type ClassAnalytics, type StudentReadiness } from "@/lib/api";
import UserAvatar from "@/components/UserAvatar";
import { useUserRole } from "@/lib/useUserRole";
import { Upload, FileText, Loader2, Plus, Link2, X, Check, ClipboardList, CalendarDays, TrendingUp, TrendingDown, Users } from "lucide-react";

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
  const [analytics, setAnalytics] = useState<ClassAnalytics | null>(null);
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);
  const [subject, setSubject] = useState<string | null>(null);
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

  // Class analytics, scoped to the selected subject. When the class only has
  // diagnostics in one subject it is auto-selected, so a single-subject class
  // shows the per-subject statistics without an extra click. A subject that
  // does not exist in the newly selected class is dropped.
  useEffect(() => {
    if (!selectedWs) return;
    fetchClassAnalytics(selectedWs, subject)
      .then((data) => {
        setAnalytics(data);
        if (subject && !data.subjects.includes(subject)) setSubject(null);
        else if (!subject && data.subjects.length === 1) setSubject(data.subjects[0]);
      })
      .catch(() => setAnalytics(null));
  }, [selectedWs, subject]);

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClass.title) return;
    setCreating(true);
    setError("");
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setError("Not signed in");
      setCreating(false);
      return;
    }
    const { data, error: err } = await supabase
      .from("workspaces")
      .insert({
        title: newClass.title,
        subject: newClass.subject || "General",
        grade: newClass.grade || "",
        user_id: userData.user.id,
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

  const readinessChip = (r: StudentReadiness["readiness"]) => {
    switch (r) {
      case "ready":
        return "bg-green-100 border-green-300 text-green-800";
      case "on_track":
        return "bg-yellow-100 border-yellow-300 text-yellow-800";
      case "at_risk":
        return "bg-red-100 border-red-300 text-red-800";
      default:
        return "bg-surface border-border text-muted";
    }
  };

  const readinessLabel = (r: StudentReadiness["readiness"]) =>
    r === "ready"
      ? t("teacher.ready")
      : r === "on_track"
        ? t("teacher.onTrack")
        : r === "at_risk"
          ? t("teacher.atRisk")
          : t("teacher.noData");

  const topicBar = (pct: number) => (pct >= 75 ? "bg-green-500" : pct >= 45 ? "bg-yellow-500" : "bg-red-500");

  // Trend between the two latest diagnostic attempts (null = only one test).
  const diagTrend = (s: StudentReadiness) => {
    if (s.diagnostics.length < 2) return null;
    return (s.diagnostics[0].pct ?? 0) - (s.diagnostics[1].pct ?? 0);
  };

  // Class-level numbers for the current subject scope (or the whole class).
  const scope = analytics?.students ?? [];
  const taken = scope.filter((s) => s.pct !== null);
  const classAvg = taken.length
    ? Math.round(taken.reduce((a, s) => a + (s.pct ?? 0), 0) / taken.length)
    : null;
  const readyCount = scope.filter((s) => s.readiness === "ready").length;
  const onTrackCount = scope.filter((s) => s.readiness === "on_track").length;
  const atRiskCount = scope.filter((s) => s.readiness === "at_risk").length;
  const withRoadmap = scope.filter((s) => s.roadmap_total > 0);
  const roadmapAvg = withRoadmap.length
    ? Math.round(
        withRoadmap.reduce((a, s) => a + (100 * s.roadmap_done / s.roadmap_total), 0) /
          withRoadmap.length
      )
    : null;
  const hwDone = scope.reduce((a, s) => a + s.assignments_done, 0);
  const hwTotal = scope.reduce((a, s) => a + s.assignments_total, 0);

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

          {/* Class insights — struggling topics + per-student readiness */}
          <div className="border border-border bg-surface overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-3 flex-wrap">
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted">
                [ {t("teacher.insights")} ]
              </span>
              {analytics && analytics.subjects.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-mono text-[9px] uppercase tracking-widest text-muted">
                    {t("teacher.bySubject")}
                  </span>
                  {analytics.subjects.map((s) => (
                    <button
                      key={s}
                      onClick={() => setSubject(subject === s ? null : s)}
                      className={`px-2.5 py-1 text-xs font-medium border transition-colors ${
                        subject === s
                          ? "bg-primary text-foreground border-primary"
                          : "border-border text-muted hover:border-primary hover:text-foreground"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {subject && analytics && (
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-px bg-border border-b border-border">
                <div className="bg-surface p-3">
                  <div className="font-mono text-[9px] uppercase tracking-widest text-muted">
                    {t("teacher.avgScore")}
                  </div>
                  <div className="text-xl font-semibold mt-0.5">
                    {classAvg === null ? "—" : `${classAvg}%`}
                  </div>
                </div>
                <div className="bg-surface p-3">
                  <div className="font-mono text-[9px] uppercase tracking-widest text-muted">
                    {t("teacher.coverage")}
                  </div>
                  <div className="text-xl font-semibold mt-0.5">
                    {taken.length}/{scope.length}
                  </div>
                </div>
                <div className="bg-surface p-3">
                  <div className="font-mono text-[9px] uppercase tracking-widest text-muted">
                    {t("teacher.roadmapAvg")}
                  </div>
                  <div className="text-xl font-semibold mt-0.5">
                    {roadmapAvg === null ? "—" : `${roadmapAvg}%`}
                  </div>
                </div>
                <div className="bg-surface p-3">
                  <div className="font-mono text-[9px] uppercase tracking-widest text-muted">
                    {t("teacher.hw")}
                  </div>
                  <div className="text-xl font-semibold mt-0.5">
                    {hwTotal > 0 ? `${hwDone}/${hwTotal}` : "—"}
                  </div>
                </div>
                <div className="bg-surface p-3">
                  <div className="font-mono text-[9px] uppercase tracking-widest text-muted">
                    {t("teacher.ready")}
                  </div>
                  <div className="text-xl font-semibold mt-0.5 text-green-600">{readyCount}</div>
                </div>
                <div className="bg-surface p-3">
                  <div className="font-mono text-[9px] uppercase tracking-widest text-muted">
                    {t("teacher.onTrack")}
                  </div>
                  <div className="text-xl font-semibold mt-0.5 text-yellow-600">{onTrackCount}</div>
                </div>
                <div className="bg-surface p-3">
                  <div className="font-mono text-[9px] uppercase tracking-widest text-muted">
                    {t("teacher.atRisk")}
                  </div>
                  <div className="text-xl font-semibold mt-0.5 text-red-600">{atRiskCount}</div>
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 lg:grid-cols-2">
              <div className="p-4 border-b lg:border-b-0 lg:border-r border-border">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp size={14} className="text-red-500" />
                  <span className="text-sm font-medium">{t("teacher.struggling")}</span>
                </div>
                {analytics && analytics.topics.length > 0 ? (
                  <div className="space-y-3">
                    {analytics.topics.slice(0, 8).map((topic) => (
                      <div key={topic.topic}>
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-sm truncate">{topic.topic}</span>
                          <button
                            onClick={() => {
                              setNewAssign((prev) => ({ ...prev, topic: topic.topic }));
                              setShowAssign(true);
                            }}
                            className="flex items-center gap-1 text-[11px] font-medium border border-primary/40 text-primary px-2 py-0.5 hover:bg-primary/10 transition-colors flex-shrink-0"
                          >
                            <Plus size={10} /> {t("teacher.assignFor")}
                          </button>
                        </div>
                        <div className="h-1.5 bg-border rounded overflow-hidden">
                          <div
                            className={`h-full rounded ${topicBar(topic.pct)}`}
                            style={{ width: `${Math.max(4, topic.pct)}%` }}
                          />
                        </div>
                        <div className="font-mono text-[10px] text-muted mt-1">
                          {topic.correct}/{topic.total} · {topic.pct}% {t("teacher.masteryPct")} · {topic.students} {t("teacher.studentsShort")}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted">{t("teacher.noTopics")}</p>
                )}
              </div>
              <div className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Users size={14} className="text-primary" />
                  <span className="text-sm font-medium">{t("teacher.readiness")}</span>
                </div>
                {analytics && analytics.students.length > 0 ? (
                  <div className="divide-y divide-border">
                    {analytics.students.map((s) => {
                      const delta = diagTrend(s);
                      const expanded = expandedStudent === s.user_id;
                      return (
                        <div key={s.user_id}>
                          <button
                            onClick={() => setExpandedStudent(expanded ? null : s.user_id)}
                            className="w-full flex items-center justify-between gap-3 py-2.5 text-left hover:bg-surface transition-colors"
                          >
                            <div className="min-w-0">
                              <div className="text-sm font-medium truncate">
                                {s.email || s.user_id.slice(0, 8)}
                                {s.diagnostics.length > 1 && (
                                  <span className="ml-2 font-mono text-[9px] uppercase text-muted border border-border px-1.5 py-0.5">
                                    {s.diagnostics.length}×
                                  </span>
                                )}
                              </div>
                              <div className="font-mono text-[10px] text-muted truncate">
                                {s.correct !== null && s.total ? `${s.correct}/${s.total} · ` : ""}
                                {s.roadmap_total > 0 ? `RM ${s.roadmap_done}/${s.roadmap_total} · ` : ""}
                                HW {s.assignments_done}/{s.assignments_total} · {s.completed}✓ {s.failed}✗
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {delta !== null && delta !== 0 && (
                                <span
                                  className={`flex items-center gap-0.5 font-mono text-[10px] ${delta > 0 ? "text-green-600" : "text-red-600"}`}
                                  title={t("teacher.trendTitle")}
                                >
                                  {delta > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                                  {Math.abs(delta)}%
                                </span>
                              )}
                              <span
                                title={
                                  s.readiness_score !== null
                                    ? `${t("teacher.scoreTitle")} (${s.readiness_score})`
                                    : t("teacher.scoreTitle")
                                }
                                className={`text-[11px] font-medium border px-2 py-0.5 ${readinessChip(s.readiness)}`}
                              >
                                {readinessLabel(s.readiness)}
                              </span>
                            </div>
                          </button>
                          {expanded && s.diagnostics.length > 0 && (
                            <div className="pb-2.5 -mt-1">
                              <div className="font-mono text-[9px] uppercase tracking-widest text-muted mb-1.5 pl-1">
                                [ {t("teacher.history")} ]
                              </div>
                              <div className="space-y-1">
                                {s.diagnostics.map((d, i) => (
                                  <div key={i} className="flex items-center gap-2 pl-1 font-mono text-[10px] text-muted">
                                    <span className="flex-shrink-0">
                                      {new Date(d.created_at).toLocaleDateString()}
                                    </span>
                                    <span className="truncate">{d.subject}</span>
                                    <span className="ml-auto flex-shrink-0">
                                      {d.correct}/{d.total} ({d.pct}%)
                                    </span>
                                    <span className="flex-shrink-0">{d.level}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : members.length > 0 ? (
                  <div className="divide-y divide-border">
                    {members.map((s) => (
                      <div key={s.student_id} className="flex items-center justify-between gap-3 py-2.5">
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{s.email || s.student_id.slice(0, 8)}</div>
                          <div className="font-mono text-[10px] text-muted">
                            {s.completed}✓ {s.failed}✗
                          </div>
                        </div>
                        <span className="flex-shrink-0 text-[11px] font-medium border border-border px-2 py-0.5 text-muted">
                          {t("teacher.noData")}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted">{t("teacher.noStudents")}</p>
                )}
              </div>
            </div>
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
