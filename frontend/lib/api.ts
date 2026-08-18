const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function apiFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json();
}

export async function uploadPdf(workspaceId: string, file: File) {
  const form = new FormData();
  form.append("workspace_id", workspaceId);
  form.append("file", file);
  return apiFetch("/api/ai/upload-and-index", {
    method: "POST",
    body: form,
  });
}

export async function generatePodcast(workspaceId: string, sourceId: string, lang: string) {
  return apiFetch("/api/ai/generate-podcast", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workspace_id: workspaceId, source_id: sourceId, lang }),
  });
}

export async function socraticChat(workspaceId: string, question: string, lang: string) {
  return apiFetch("/api/ai/socratic-chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workspace_id: workspaceId, question, lang }),
  });
}

export async function socraticAnswer(workspaceId: string, asked: string, answer: string, lang: string) {
  return apiFetch("/api/ai/socratic-answer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workspace_id: workspaceId, asked, answer, lang }),
  });
}

export async function fetchSummary(workspaceId: string, sourceId: string, lang: string) {
  return apiFetch("/api/ai/summary", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workspace_id: workspaceId, source_id: sourceId, lang }),
  });
}

export async function fetchHeatmap(workspaceId: string) {
  return apiFetch(`/api/ai/teacher/heatmap?workspace_id=${encodeURIComponent(workspaceId)}`);
}
