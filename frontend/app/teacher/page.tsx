"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/components/LocaleProvider";
import { createClient } from "@/lib/supabase/client";
import { fetchHeatmap, uploadPdf } from "@/lib/api";
import UserAvatar from "@/components/UserAvatar";
import { Upload, FileText, Loader2 } from "lucide-react";

type Workspace = { id: string; title: string; subject: string; grade: string };
type HeatmapNode = {
  node_id: string;
  failures: number;
  completions: number;
  total_errors: number;
  intensity: number;
};
type StudentRow = {
  email: string | null;
  completed: number;
  failed: number;
  errors: number;
};

export default function TeacherPage() {
  const { t } = useLocale();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWs, setSelectedWs] = useState<string | null>(null);
  const [heatmap, setHeatmap] = useState<HeatmapNode[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [sources, setSources] = useState<{ id: string; file_name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const supabase = createClient();

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userData.user.id)
        .single();
      const { data: ws } = await supabase.from("workspaces").select("id, title, subject, grade");
      if (ws) {
        setWorkspaces(ws);
        if (ws.length > 0) setSelectedWs(ws[0].id);
      }
    })();
  }, [supabase]);

  useEffect(() => {
    if (!selectedWs) return;
    setLoading(true);

    fetchHeatmap(selectedWs)
      .then((res) => setHeatmap(res.nodes))
      .catch((err) => setError(err.message || "Failed to load heatmap"));

    supabase
      .from("sources")
      .select("id, file_name")
      .eq("workspace_id", selectedWs)
      .then(({ data }) => setSources(data || []));

    supabase
      .from("student_progress")
      .select("student_id, status, error_count")
      .eq("workspace_id", selectedWs)
      .then(async ({ data }) => {
        if (!data || data.length === 0) {
          setStudents([]);
          setLoading(false);
          return;
        }
        const ids = [...new Set(data.map((r) => r.student_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, email")
          .in("id", ids);
        const emailById = new Map((profiles || []).map((p) => [p.id, p.email]));
        const map = new Map<string, StudentRow>();
        for (const r of data) {
          const row = map.get(r.student_id) || { email: null, completed: 0, failed: 0, errors: 0 };
          if (r.status === "completed") row.completed += 1;
          else row.failed += 1;
          row.errors += r.error_count || 0;
          row.email = emailById.get(r.student_id) || null;
          map.set(r.student_id, row);
        }
        setStudents([...map.values()]);
        setLoading(false);
      });
  }, [selectedWs, supabase]);

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

  const totalAttempts = students.reduce((a, s) => a + s.completed + s.failed, 0);
  const totalCompleted = students.reduce((a, s) => a + s.completed, 0);
  const successRate = totalAttempts > 0 ? Math.round((totalCompleted / totalAttempts) * 100) : null;

  return (
    <div className="flex flex-col min-h-screen">
      <header className="flex items-center justify-between px-6 py-3 border-b border-border bg-white">
        <div>
          <div className="text-sm font-semibold">{t("teacher.mode")}</div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted">
            [ TEACHER_CONSOLE: LIVE ]
          </div>
        </div>
        <UserAvatar />
      </header>

      {error && (
        <div className="border-b border-border bg-white px-6 py-2.5 text-sm text-red-600 font-mono">
          [ ERROR ] {error}
        </div>
      )}

      <main className="flex-1 p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-3 border border-border divide-y md:divide-y-0 md:divide-x divide-border bg-white">
            <div className="p-5">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted">
                [ CLASSES ]
              </div>
              <div className="text-2xl font-semibold mt-1">{workspaces.length}</div>
            </div>
            <div className="p-5">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted">
                [ STUDENTS ]
              </div>
              <div className="text-2xl font-semibold mt-1">{students.length}</div>
            </div>
            <div className="p-5">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted">
                [ SUCCESS RATE ]
              </div>
              <div className="text-2xl font-semibold mt-1">
                {successRate === null ? "—" : `${successRate}%`}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Class list */}
            <div className="border border-border bg-white">
              <div className="px-4 py-3 border-b border-border font-mono text-[10px] uppercase tracking-widest text-muted">
                [ CLASSES ]
              </div>
              {workspaces.length === 0 ? (
                <div className="p-4 text-sm text-muted">No classes yet.</div>
              ) : (
                <div className="divide-y divide-border">
                  {workspaces.map((ws) => (
                    <button
                      key={ws.id}
                      onClick={() => setSelectedWs(ws.id)}
                      className={`w-full text-left p-4 text-sm transition-colors ${
                        selectedWs === ws.id
                          ? "bg-foreground text-white"
                          : "hover:bg-surface"
                      }`}
                    >
                      <div className="font-medium">{ws.title}</div>
                      <div className={`text-xs mt-0.5 ${selectedWs === ws.id ? "text-white/70" : "text-muted"}`}>
                        {ws.subject} / Grade {ws.grade}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Upload */}
            <div className="md:col-span-2 border border-border bg-white">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted">
                  [ UPLOAD_MATERIAL ]
                </span>
                {sources.length > 0 && (
                  <span className="font-mono text-[10px] uppercase text-muted">
                    {sources.length} FILE{sources.length > 1 ? "S" : ""}
                  </span>
                )}
              </div>
              <div className="p-4">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading || !selectedWs}
                  className="w-full border-2 border-dashed border-border p-8 flex flex-col items-center justify-center text-center hover:border-foreground transition-colors disabled:opacity-40"
                >
                  {uploading ? (
                    <Loader2 size={20} className="animate-spin text-muted mb-3" />
                  ) : (
                    <Upload size={20} className="text-muted mb-3" />
                  )}
                  <p className="text-sm font-medium">
                    {uploading ? "Uploading and indexing…" : t("upload.material")}
                  </p>
                  <p className="text-xs text-muted mt-1 font-mono">
                    PDF · parsed · chunked · embedded
                  </p>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={handleUpload}
                />
                {sources.length > 0 && (
                  <div className="mt-4 divide-y divide-border border border-border">
                    {sources.map((s, i) => (
                      <div key={s.id} className="flex items-center gap-2 px-3 py-2 text-sm text-muted">
                        <FileText size={13} className="text-muted flex-shrink-0" />
                        <span className="font-mono text-[10px] text-muted">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span className="truncate">{s.file_name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Roster */}
          <div className="border border-border bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-border font-mono text-[10px] uppercase tracking-widest text-muted">
              [ CLASS_ROSTER ]
            </div>
            {students.length === 0 ? (
              <div className="p-4 text-sm text-muted">No progress recorded yet.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted border-b border-border font-mono uppercase tracking-wider">
                    <th className="px-4 py-2.5 font-medium">Student</th>
                    <th className="px-4 py-2.5 font-medium">Completed</th>
                    <th className="px-4 py-2.5 font-medium">Failed</th>
                    <th className="px-4 py-2.5 font-medium">Errors</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {students.map((s, i) => (
                    <tr key={i}>
                      <td className="px-4 py-2.5 font-medium">{s.email || "Unknown student"}</td>
                      <td className="px-4 py-2.5 text-green-700">{s.completed}</td>
                      <td className="px-4 py-2.5 text-red-600">{s.failed}</td>
                      <td className="px-4 py-2.5 text-muted">{s.errors}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Heatmap */}
          <div className="border border-border bg-white">
            <div className="px-4 py-3 border-b border-border font-mono text-[10px] uppercase tracking-widest text-muted">
              [ HEATMAP: STUMBLING NODES ]
            </div>
            {loading ? (
              <div className="flex items-center gap-2 p-6 text-sm text-muted">
                <Loader2 size={14} className="animate-spin" />
                Loading analytics…
              </div>
            ) : heatmap.length === 0 ? (
              <div className="p-6 text-sm text-muted">
                No analytics yet. Ask students to start lessons.
              </div>
            ) : (
              <div className="p-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                {heatmap.map((node) => (
                  <div
                    key={node.node_id}
                    className={`border p-2.5 ${heatIntensity(node.intensity)}`}
                    title={`Failures: ${node.failures} · Errors: ${node.total_errors}`}
                  >
                    <div className="text-xs font-medium truncate">{node.node_id}</div>
                    <div className="font-mono text-[10px] mt-1 opacity-70">
                      F:{node.failures} C:{node.completions}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}