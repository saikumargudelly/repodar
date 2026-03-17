"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import ReactMarkdown from "react-markdown";
import { api, ResearchMessage, ResearchPin, ResearchRepo } from "@/lib/api";

// ─── Tiny markdown renderer stub if react-markdown isn't installed ─────────────
// If ReactMarkdown isn't available, we'll inline render
function MD({ children }: { children: string }) {
  try {
    return <ReactMarkdown>{children}</ReactMarkdown>;
  } catch {
    return <div style={{ whiteSpace: "pre-wrap" }}>{children}</div>;
  }
}

const TREND_COLORS: Record<string, string> = {
  HIGH: "var(--accent-green)",
  MID: "var(--accent-yellow, #e3b341)",
  LOW: "var(--accent-red, #f85149)",
};

const STAGE_LABELS: Record<string, string> = {
  watch: "📡 Watch",
  evaluate: "🔍 Evaluate",
  track: "📈 Track",
  dismiss: "✕ Dismiss",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function RepoCard({
  repo,
  onPin,
  isPinned,
  onAddToReport,
  sessionId,
  userId,
}: {
  repo: ResearchRepo;
  onPin: (r: ResearchRepo) => void;
  isPinned: boolean;
  onAddToReport?: (r: ResearchRepo) => void;
  sessionId?: string;
  userId?: string;
}) {
  const router = useRouter();
  const starsK = repo.stars >= 1000 ? `${(repo.stars / 1000).toFixed(1)}k` : String(repo.stars);
  const [blogOpen, setBlogOpen] = useState(false);
  const [blogPlatform, setBlogPlatform] = useState<"reddit"|"twitter"|"linkedin">("reddit");
  const [blogContent, setBlogContent] = useState("");
  const [generatingBlog, setGeneratingBlog] = useState(false);
  const [blogCopied, setBlogCopied] = useState(false);

  const handleGenerateBlog = async () => {
    if (!sessionId || !userId) return;
    setGeneratingBlog(true);
    setBlogContent("");
    try {
      const result = await api.research.generateBlog(sessionId, userId, blogPlatform, repo as unknown as Record<string, unknown>);
      setBlogContent(result.content);
    } catch (e) { console.error(e); }
    finally { setGeneratingBlog(false); }
  };

  const handleCopyBlog = () => {
    navigator.clipboard.writeText(blogContent);
    setBlogCopied(true);
    setTimeout(() => setBlogCopied(false), 2000);
  };

  const PLATFORMS: { key: "reddit"|"twitter"|"linkedin"; icon: string; label: string }[] = [
    { key: "reddit", icon: "🟠", label: "Reddit" },
    { key: "twitter", icon: "𝕏", label: "Twitter/X" },
    { key: "linkedin", icon: "💼", label: "LinkedIn" },
  ];

  return (
    <div style={{
      background: "var(--bg-elevated)",
      border: `1px solid var(--border)`,
      borderLeft: `3px solid ${TREND_COLORS[repo.trend_label] ?? "var(--border)"}`,
      borderRadius: "8px",
      padding: "12px 14px",
      display: "flex",
      flexDirection: "column",
      gap: "6px",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px" }}>
        <a
          href={repo.github_url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: "13px", color: "var(--accent-blue)", textDecoration: "none", lineHeight: 1.3 }}
        >
          {repo.full_name}
        </a>
        <span style={{
          padding: "2px 7px", borderRadius: "10px",
          fontSize: "10px", fontWeight: 700, fontFamily: "var(--font-sans)",
          background: `${TREND_COLORS[repo.trend_label]}22`,
          color: TREND_COLORS[repo.trend_label],
          border: `1px solid ${TREND_COLORS[repo.trend_label]}44`,
          whiteSpace: "nowrap", flexShrink: 0,
        }}>
          {repo.trend_label}
        </span>
      </div>

      <div style={{ fontFamily: "var(--font-sans)", fontSize: "11px", color: "var(--text-muted)", lineHeight: 1.4 }}>
        {repo.description?.slice(0, 100) || "No description"}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
        <span style={{ fontFamily: "var(--font-mono, monospace)", fontSize: "11px", color: "var(--text-secondary)" }}>⭐ {starsK}</span>
        {repo.primary_language && (
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "11px", color: "var(--text-muted)" }}>• {repo.primary_language}</span>
        )}
        {repo.topics?.slice(0, 2).map((t) => (
          <span key={t} style={{ fontFamily: "var(--font-sans)", fontSize: "10px", color: "var(--text-muted)", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "4px", padding: "1px 6px" }}>
            {t}
          </span>
        ))}
      </div>

      <div style={{ display: "flex", gap: "6px", marginTop: "2px", flexWrap: "wrap" }}>
        <button
          onClick={() => onPin(repo)}
          style={{
            fontFamily: "var(--font-sans)", fontSize: "11px", fontWeight: 600,
            padding: "4px 10px", borderRadius: "6px", border: "1px solid var(--border)",
            cursor: "pointer", transition: "all 0.13s",
            background: isPinned ? "rgba(88,166,255,0.15)" : "var(--bg-surface)",
            color: isPinned ? "var(--accent-blue)" : "var(--text-muted)",
            borderColor: isPinned ? "var(--accent-blue)" : "var(--border)",
          }}
        >
          {isPinned ? "📌 Pinned" : "📌 Pin"}
        </button>

        {/* Internal detail navigation */}
        <button
          onClick={() => router.push(`/repo/${repo.full_name}`)}
          style={{
            fontFamily: "var(--font-sans)", fontSize: "11px", fontWeight: 600,
            padding: "4px 10px", borderRadius: "6px", border: "1px solid var(--border)",
            cursor: "pointer", background: "var(--bg-surface)", color: "var(--text-muted)",
            transition: "all 0.13s",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--accent-blue)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--accent-blue)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; }}
        >
          📊 Details
        </button>

        {/* Blog/Social post generator */}
        <button
          onClick={() => setBlogOpen(!blogOpen)}
          style={{
            fontFamily: "var(--font-sans)", fontSize: "11px", fontWeight: 600,
            padding: "4px 10px", borderRadius: "6px", border: `1px solid ${blogOpen ? "var(--accent-blue)" : "var(--border)"}`,
            cursor: "pointer", background: blogOpen ? "rgba(88,166,255,0.1)" : "var(--bg-surface)",
            color: blogOpen ? "var(--accent-blue)" : "var(--text-muted)",
            transition: "all 0.13s",
          }}
        >
          ✍️ Blog
        </button>

        {onAddToReport && (
          <button
            onClick={() => onAddToReport(repo)}
            style={{
              fontFamily: "var(--font-sans)", fontSize: "11px", fontWeight: 600,
              padding: "4px 10px", borderRadius: "6px", border: "1px solid var(--border)",
              cursor: "pointer", background: "var(--bg-surface)", color: "var(--text-muted)",
              transition: "all 0.13s",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--accent-blue)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"; }}
          >
            → Report
          </button>
        )}
      </div>

      {/* Blog generator inline panel */}
      {blogOpen && (
        <div style={{
          marginTop: "8px", padding: "12px", borderRadius: "8px",
          background: "var(--bg-surface)", border: "1px solid var(--border)",
          display: "flex", flexDirection: "column", gap: "8px",
        }}>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)" }}>✍️ Generate social post for {repo.name}</div>
          {/* Platform selector tabs */}
          <div style={{ display: "flex", gap: "4px" }}>
            {PLATFORMS.map(p => (
              <button key={p.key} onClick={() => setBlogPlatform(p.key)} style={{
                fontFamily: "var(--font-sans)", fontSize: "10px", fontWeight: 600,
                padding: "3px 8px", borderRadius: "5px",
                border: `1px solid ${blogPlatform === p.key ? "var(--accent-blue)" : "var(--border)"}`,
                background: blogPlatform === p.key ? "rgba(88,166,255,0.15)" : "transparent",
                color: blogPlatform === p.key ? "var(--accent-blue)" : "var(--text-muted)",
                cursor: "pointer",
              }}>{p.icon} {p.label}</button>
            ))}
          </div>
          <button
            onClick={handleGenerateBlog}
            disabled={generatingBlog}
            style={{
              fontFamily: "var(--font-sans)", fontSize: "11px", fontWeight: 600,
              padding: "5px 12px", borderRadius: "6px", border: "1px solid var(--accent-blue)",
              cursor: generatingBlog ? "wait" : "pointer",
              background: generatingBlog ? "rgba(88,166,255,0.1)" : "var(--accent-blue)",
              color: generatingBlog ? "var(--accent-blue)" : "#fff",
              opacity: generatingBlog ? 0.7 : 1, alignSelf: "flex-start",
            }}
          >
            {generatingBlog ? "⏳ Generating…" : "⚡ Generate"}
          </button>
          {blogContent && (
            <div style={{ position: "relative" }}>
              <textarea
                readOnly value={blogContent}
                rows={8}
                style={{
                  width: "100%", resize: "vertical", fontFamily: "var(--font-sans)", fontSize: "11px",
                  color: "var(--text-primary)", background: "var(--bg-elevated)",
                  border: "1px solid var(--border)", borderRadius: "6px", padding: "8px 10px",
                  lineHeight: 1.5,
                }}
              />
              <button
                onClick={handleCopyBlog}
                style={{
                  position: "absolute", top: "6px", right: "8px",
                  fontFamily: "var(--font-sans)", fontSize: "10px", fontWeight: 600,
                  padding: "3px 8px", borderRadius: "4px",
                  border: "1px solid var(--border)",
                  background: blogCopied ? "rgba(63,185,80,0.15)" : "var(--bg-surface)",
                  color: blogCopied ? "var(--accent-green)" : "var(--text-muted)",
                  cursor: "pointer",
                }}
              >
                {blogCopied ? "✓ Copied!" : "Copy"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


function ChatBubble({
  msg,
  onPin,
  pinnedNames,
  sessionId,
  userId,
}: {
  msg: ResearchMessage;
  onPin: (r: ResearchRepo) => void;
  pinnedNames: Set<string>;
  sessionId: string;
  userId: string | null | undefined;
}) {
  const isUser = msg.role === "user";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px", alignItems: isUser ? "flex-end" : "flex-start" }}>
      {/* Query explanation (agent only) */}
      {!isUser && msg.query_explanation && (
        <div style={{
          fontFamily: "var(--font-sans)", fontSize: "11px", color: "var(--text-muted)",
          display: "flex", alignItems: "center", gap: "6px",
          padding: "4px 10px", background: "var(--bg-elevated)", borderRadius: "6px",
          border: "1px solid var(--border)", maxWidth: "90%",
        }}>
          🔍 <em>{msg.query_explanation}</em>
        </div>
      )}

      {/* Bubble */}
      <div style={{
        maxWidth: "92%",
        background: isUser ? "var(--accent-blue)" : "var(--bg-elevated)",
        color: isUser ? "#fff" : "var(--text-primary)",
        border: `1px solid ${isUser ? "transparent" : "var(--border)"}`,
        borderRadius: isUser ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
        padding: "10px 14px",
        fontFamily: "var(--font-sans)",
        fontSize: "13px",
        lineHeight: 1.6,
      }}>
        <div className="research-md">
          <MD>{msg.content}</MD>
        </div>
      </div>

      {/* Repo cards from agent results */}
      {!isUser && msg.repos && msg.repos.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", width: "100%", paddingLeft: "4px" }}>
          {msg.repos.slice(0, 8).map((r) => (
            <RepoCard key={r.full_name} repo={r} onPin={onPin} isPinned={pinnedNames.has(r.full_name)} sessionId={sessionId} userId={userId ?? undefined} />
          ))}
          {msg.repos.length > 8 && (
            <div style={{ fontFamily: "var(--font-sans)", fontSize: "11px", color: "var(--text-muted)", padding: "4px 8px" }}>
              +{msg.repos.length - 8} more repos
            </div>
          )}
        </div>
      )}
    </div>
  );
}


// ── Streaming bubble (assembles tokens in real-time) ─────────────────────────
function StreamingBubble({ text, repos, status, queryExplanation }: {
  text: string; repos: ResearchRepo[]; status: string; queryExplanation?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      {queryExplanation && (
        <div style={{
          fontFamily: "var(--font-sans)", fontSize: "11px", color: "var(--text-muted)",
          display: "flex", alignItems: "center", gap: "6px",
          padding: "4px 10px", background: "var(--bg-elevated)", borderRadius: "6px",
          border: "1px solid var(--border)", maxWidth: "90%",
        }}>
          🔍 <em>{queryExplanation}</em>
        </div>
      )}
      {status && !text && (
        <div style={{
          fontFamily: "var(--font-sans)", fontSize: "12px", color: "var(--text-muted)",
          display: "flex", alignItems: "center", gap: "8px",
          padding: "8px 14px", background: "var(--bg-elevated)", border: "1px solid var(--border)",
          borderRadius: "14px 14px 14px 4px",
        }}>
          <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", background: "var(--accent-blue)", animation: "pulse 1.2s ease infinite" }} />
          {status}
        </div>
      )}
      {text && (
        <div style={{
          maxWidth: "92%", background: "var(--bg-elevated)", color: "var(--text-primary)",
          border: "1px solid var(--border)", borderRadius: "14px 14px 14px 4px",
          padding: "10px 14px", fontFamily: "var(--font-sans)", fontSize: "13px", lineHeight: 1.6,
        }}>
          <div className="research-md"><MD>{text}</MD></div>
          <span style={{ display: "inline-block", width: "2px", height: "14px", background: "var(--accent-blue)", verticalAlign: "middle", animation: "blink 0.7s step-end infinite", marginLeft: "2px" }} />
        </div>
      )}
      {repos.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", paddingLeft: "4px" }}>
          {repos.slice(0, 5).map((r) => (
            <div key={r.full_name} style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "8px", padding: "10px 12px", fontFamily: "var(--font-sans)", fontSize: "12px", color: "var(--text-muted)" }}>
              <strong style={{ color: "var(--accent-blue)" }}>{r.full_name}</strong> — {(r.stars / 1000).toFixed(1)}k ⭐ · {r.trend_label} · {r.description?.slice(0, 60)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


// ─── Main page ────────────────────────────────────────────────────────────────

export default function ResearchSessionPage() {
  const { id: sessionId } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { userId, isLoaded } = useAuth();

  // Session state
  const [title, setTitle] = useState("Untitled Research");
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");

  // Chat state
  const [messages, setMessages] = useState<ResearchMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [streamRepos, setStreamRepos] = useState<ResearchRepo[]>([]);
  const [streamStatus, setStreamStatus] = useState("");
  const [streamQueryExp, setStreamQueryExp] = useState("");
  const [followUps, setFollowUps] = useState<string[]>([]);

  // Report / pins state
  const [pins, setPins] = useState<ResearchPin[]>([]);
  const [reportMd, setReportMd] = useState<string | null>(null);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [activePanel, setActivePanel] = useState<"report" | "pins">("report");
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const esRef = useRef<EventSource | null>(null);

  // Load session
  useEffect(() => {
    if (!isLoaded || !userId) return;
    api.research.getSession(sessionId, userId).then((data) => {
      setTitle(data.title);
      setTitleDraft(data.title);
      setMessages(data.messages);
      setPins(data.pins);
      if (data.report) setReportMd(data.report.content_md);
    }).catch(console.error);
  }, [isLoaded, userId, sessionId]);

  // Auto-send ?q= parameter from quick-start
  useEffect(() => {
    const q = searchParams.get("q");
    if (q && messages.length === 0) {
      setInput(q);
      setTimeout(() => handleSend(q), 300);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamText, streamStatus]);

  const pinnedNames = new Set(pins.map((p) => p.repo_full_name));

  // ── Pin a repo ──────────────────────────────────────────────────────────────
  const handlePin = useCallback(async (repo: ResearchRepo) => {
    if (!userId) return;
    if (pinnedNames.has(repo.full_name)) return;
    try {
      const pin = await api.research.pinRepo(
        sessionId, userId, repo.full_name, repo as unknown as Record<string, unknown>
      );
      setPins((prev) => [...prev, pin]);
    } catch (e) { console.error(e); }
  }, [sessionId, userId, pinnedNames]);

  const handleUnpin = async (pinId: string) => {
    if (!userId) return;
    await api.research.unpinRepo(sessionId, userId, pinId);
    setPins((prev) => prev.filter((p) => p.id !== pinId));
  };

  const handleUpdatePinStage = async (pinId: string, stage: string) => {
    if (!userId) return;
    const updated = await api.research.updatePin(sessionId, userId, pinId, { stage });
    setPins((prev) => prev.map((p) => (p.id === pinId ? updated : p)));
  };

  // ── Send message via SSE ────────────────────────────────────────────────────
  const handleSend = useCallback(async (overrideInput?: string) => {
    const text = (overrideInput ?? input).trim();
    if (!text || !userId || sending) return;

    setSending(true);
    setInput("");
    setFollowUps([]);
    setStreamText("");
    setStreamRepos([]);
    setStreamStatus("Connecting…");
    setStreamQueryExp("");

    // Optimistically add user message
    const userMsg: ResearchMessage = {
      id: `tmp-${Date.now()}`, role: "user", content: text,
      intent: null, github_query: null, query_explanation: null,
      repos: [], confidence: null, created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);

    // Close any existing SSE
    if (esRef.current) { esRef.current.close(); esRef.current = null; }

    const url = api.research.streamUrl(sessionId, userId, text);
    const es = new EventSource(url);
    esRef.current = es;

    let accText = "";
    let accRepos: ResearchRepo[] = [];
    let doneMeta: Record<string, unknown> = {};

    es.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data);
        const { type } = payload;

        if (type === "status") setStreamStatus(payload.text);
        else if (type === "query_explanation") setStreamQueryExp(payload.text);
        else if (type === "repos") {
          accRepos = payload.data;
          setStreamRepos(payload.data);
        }
        else if (type === "token") {
          accText += payload.text;
          setStreamText((t) => t + payload.text);
        }
        else if (type === "done") {
          const data = payload.data ?? payload.text ?? "";
          if (typeof data === "object") {
            doneMeta = data as Record<string, unknown>;
            setFollowUps((doneMeta.follow_ups as string[]) ?? []);
          } else if (typeof data === "string" && !accText) {
            accText = data;
          }
          es.close();
          esRef.current = null;

          // Persist streamed message in UI
          const agentMsg: ResearchMessage = {
            id: `streamed-${Date.now()}`,
            role: "agent",
            content: accText || (typeof data === "string" ? data : ""),
            intent: (doneMeta.intent as string) ?? null,
            github_query: (doneMeta.github_query as string) ?? null,
            query_explanation: (doneMeta.query_explanation as string) ?? streamQueryExp,
            repos: accRepos,
            confidence: (doneMeta.confidence as number) ?? null,
            created_at: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, agentMsg]);
          setStreamText(""); setStreamRepos([]); setStreamStatus("");
          setSending(false);
        }
        else if (type === "error") {
          const errMsg: ResearchMessage = {
            id: `err-${Date.now()}`,
            role: "agent", content: `⚠️ ${payload.text}`,
            intent: "error", github_query: null, query_explanation: null,
            repos: [], confidence: null, created_at: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, errMsg]);
          setStreamText(""); setStreamStatus(""); setSending(false);
          es.close(); esRef.current = null;
        }
      } catch { /* skip malformed events */ }
    };

    es.onerror = () => {
      es.close(); esRef.current = null;
      setStreamStatus(""); setSending(false);
      setStreamText(""); setStreamRepos([]);
    };
  }, [input, userId, sending, sessionId, streamQueryExp]);

  // ── Generate report ─────────────────────────────────────────────────────────
  const handleGenReport = async () => {
    if (!userId) return;
    setGeneratingReport(true);
    try {
      const result = await api.research.generateReport(sessionId, userId);
      setReportMd(result.content_md);
      setActivePanel("report");
    } catch (e: unknown) {
      alert((e as Error).message ?? "Failed to generate report.");
    } finally {
      setGeneratingReport(false);
    }
  };

  // ── Share ───────────────────────────────────────────────────────────────────
  const handleShare = async () => {
    if (!userId) return;
    setSharing(true);
    try {
      const { token } = await api.research.createShare(sessionId, userId, 7);
      const link = `${window.location.origin}/research/share/${token}`;
      setShareLink(link);
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e: unknown) {
      alert((e as Error).message ?? "Failed to create share link.");
    } finally {
      setSharing(false);
    }
  };

  // ── Export markdown ─────────────────────────────────────────────────────────
  const handleExportMd = () => {
    if (!reportMd) return;
    const blob = new Blob([reportMd], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${title.replace(/\s+/g, "-")}.md`;
    a.click(); URL.revokeObjectURL(url);
  };

  // ── Save title ──────────────────────────────────────────────────────────────
  const saveTitle = async () => {
    if (!userId) return;
    const trimmed = titleDraft.trim();
    if (!trimmed || trimmed === title) { setEditingTitle(false); return; }
    await api.research.updateSession(sessionId, userId, { title: trimmed });
    setTitle(trimmed);
    setEditingTitle(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="main-content" style={{ height: "calc(100vh - 0px)", display: "flex", flexDirection: "column", overflow: "hidden", padding: 0 }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes blink { 50%{opacity:0} }

        .research-md p { margin: 0 0 8px; }
        .research-md p:last-child { margin-bottom: 0; }
        .research-md ul, .research-md ol { padding-left: 20px; margin: 6px 0; }
        .research-md li { margin-bottom: 4px; }
        .research-md h1,.research-md h2,.research-md h3 { margin: 10px 0 6px; font-family: var(--font-sans); }
        .research-md code { background: rgba(88,166,255,0.1); padding: 1px 5px; border-radius: 4px; font-size: 12px; font-family: var(--font-mono, monospace); }
        .research-md pre { background: var(--bg-surface); border: 1px solid var(--border); border-radius: 6px; padding: 10px; margin: 8px 0; overflow-x: auto; }
        .research-md blockquote { border-left: 3px solid var(--accent-blue); padding-left: 12px; color: var(--text-muted); margin: 6px 0; }
        .research-md strong { color: var(--text-primary); }
        .research-md a { color: var(--accent-blue); }
        .res-panel-tab { padding: 6px 16px; border-radius: 6px; border: 1px solid var(--border); font-family: var(--font-sans); font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.13s; }
        .res-panel-tab.active { background: var(--accent-blue); color: #fff; border-color: var(--accent-blue); }
        .res-panel-tab:not(.active) { background: transparent; color: var(--text-muted); }
        .res-panel-tab:not(.active):hover { color: var(--accent-blue); border-color: var(--accent-blue); }
        @media (max-width: 900px) {
          .research-layout { flex-direction: column !important; }
          .research-report-panel { height: 45vh !important; }
          .research-chat-panel { height: 55vh !important; }
        }
      `}</style>

      {/* ── Top bar ────────────────────────────────────────────────────────── */}
      <div style={{
        height: "52px", borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", padding: "0 20px",
        justifyContent: "space-between", flexShrink: 0,
        background: "var(--bg-surface)", gap: "12px",
      }}>
        {/* Left: breadcrumb + title */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
          <button onClick={() => router.push("/research")} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "12px", fontFamily: "var(--font-sans)", display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
            🔬 Research
          </button>
          <span style={{ color: "var(--border)" }}>/</span>
          {editingTitle ? (
            <input
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={(e) => { if (e.key === "Enter") saveTitle(); if (e.key === "Escape") setEditingTitle(false); }}
              autoFocus
              style={{
                fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: "14px",
                color: "var(--text-primary)", background: "var(--bg-elevated)",
                border: "1px solid var(--accent-blue)", borderRadius: "6px",
                padding: "3px 8px", outline: "none", minWidth: "200px",
              }}
            />
          ) : (
            <span
              onClick={() => { setTitleDraft(title); setEditingTitle(true); }}
              title="Click to rename"
              style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: "14px", color: "var(--text-primary)", cursor: "text", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
            >
              {title}
            </span>
          )}
        </div>

        {/* Right: actions */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
          {pins.length >= 3 && (
            <button onClick={handleGenReport} disabled={generatingReport}
              style={{ fontFamily: "var(--font-sans)", fontSize: "12px", fontWeight: 600, padding: "5px 14px", borderRadius: "6px", border: "1px solid var(--border)", cursor: generatingReport ? "not-allowed" : "pointer", background: "var(--bg-elevated)", color: "var(--text-secondary)", transition: "all 0.13s", opacity: generatingReport ? 0.7 : 1 }}>
              {generatingReport ? "⏳ Generating…" : "📄 Generate Report"}
            </button>
          )}
          {reportMd && (
            <button onClick={handleExportMd}
              style={{ fontFamily: "var(--font-sans)", fontSize: "12px", fontWeight: 600, padding: "5px 14px", borderRadius: "6px", border: "1px solid var(--border)", cursor: "pointer", background: "var(--bg-elevated)", color: "var(--text-secondary)" }}>
              ↓ Export MD
            </button>
          )}
          <button onClick={handleShare} disabled={sharing}
            style={{ fontFamily: "var(--font-sans)", fontSize: "12px", fontWeight: 600, padding: "5px 14px", borderRadius: "6px", border: "1px solid var(--border)", cursor: sharing ? "not-allowed" : "pointer", background: copied ? "rgba(63,185,80,0.12)" : "var(--bg-elevated)", color: copied ? "var(--accent-green)" : "var(--text-secondary)", transition: "all 0.15s" }}>
            {copied ? "✓ Link Copied!" : sharing ? "…" : "🔗 Share"}
          </button>
        </div>
      </div>

      {/* ── Two-panel layout ─────────────────────────────────────────────────── */}
      <div className="research-layout" style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>

        {/* ── LEFT: Report / Pins panel (65%) ─────────────────────────────── */}
        <div className="research-report-panel" style={{
          flex: "0 0 65%", borderRight: "1px solid var(--border)",
          display: "flex", flexDirection: "column", overflow: "hidden",
        }}>
          {/* Panel tabs */}
          <div style={{
            display: "flex", alignItems: "center", gap: "8px",
            padding: "10px 16px", borderBottom: "1px solid var(--border)", flexShrink: 0,
            background: "var(--bg-surface)",
          }}>
            <button className={`res-panel-tab ${activePanel === "report" ? "active" : ""}`} onClick={() => setActivePanel("report")}>
              📄 Report
            </button>
            <button className={`res-panel-tab ${activePanel === "pins" ? "active" : ""}`} onClick={() => setActivePanel("pins")}>
              📌 Pinboard {pins.length > 0 ? `(${pins.length})` : ""}
            </button>
            {pins.length < 3 && activePanel === "report" && !reportMd && (
              <span style={{ marginLeft: "auto", fontFamily: "var(--font-sans)", fontSize: "11px", color: "var(--text-muted)" }}>
                Pin {3 - pins.length} more repo{3 - pins.length !== 1 ? "s" : ""} to generate a report
              </span>
            )}
          </div>

          {/* Panel content */}
          <div style={{ flex: 1, overflow: "auto", padding: "20px" }}>
            {activePanel === "report" ? (
              reportMd ? (
                <div className="research-md" style={{ fontFamily: "var(--font-sans)", fontSize: "13px", lineHeight: 1.7, color: "var(--text-primary)" }}>
                  <MD>{reportMd}</MD>
                </div>
              ) : (
                <div style={{
                  height: "100%", display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center", gap: "16px", textAlign: "center",
                }}>
                  <div style={{ fontSize: "48px", opacity: 0.3 }}>📄</div>
                  <div style={{ fontFamily: "var(--font-sans)", fontWeight: 600, color: "var(--text-primary)", fontSize: "15px" }}>
                    Report will appear here
                  </div>
                  <div style={{ fontFamily: "var(--font-sans)", color: "var(--text-muted)", fontSize: "12px", maxWidth: "320px" }}>
                    Chat with the agent, pin repos you find interesting, then click <strong>Generate Report</strong> to get an AI-written brief.
                  </div>
                  <div style={{ fontFamily: "var(--font-sans)", fontSize: "11px", color: "var(--text-muted)", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "6px", padding: "8px 14px" }}>
                    {pins.length}/3 repos pinned {pins.length < 3 ? `— pin ${3 - pins.length} more to unlock` : "— ready!"}
                  </div>
                </div>
              )
            ) : (
              /* Pinboard */
              pins.length === 0 ? (
                <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted)", fontFamily: "var(--font-sans)", fontSize: "13px" }}>
                  No repos pinned yet. Ask the agent to find repos, then pin the ones you want to track.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {pins.map((pin) => (
                    <div key={pin.id} style={{
                      background: "var(--bg-elevated)", border: "1px solid var(--border)",
                      borderRadius: "10px", padding: "14px 16px",
                      display: "flex", flexDirection: "column", gap: "8px",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <a href={pin.repo_data?.github_url ?? `https://github.com/${pin.repo_full_name}`} target="_blank" rel="noopener noreferrer"
                          style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: "13px", color: "var(--accent-blue)", textDecoration: "none" }}>
                          {pin.repo_full_name}
                        </a>
                        <button onClick={() => handleUnpin(pin.id)}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "16px", padding: "0 4px" }}
                          title="Unpin">×</button>
                      </div>
                      {pin.repo_data?.description && (
                        <div style={{ fontFamily: "var(--font-sans)", fontSize: "12px", color: "var(--text-muted)" }}>
                          {pin.repo_data.description.slice(0, 120)}
                        </div>
                      )}
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        {pin.repo_data?.stars !== undefined && (
                          <span style={{ fontFamily: "var(--font-sans)", fontSize: "11px", color: "var(--text-secondary)" }}>
                            ⭐ {pin.repo_data.stars >= 1000 ? `${(pin.repo_data.stars / 1000).toFixed(1)}k` : pin.repo_data.stars}
                          </span>
                        )}
                        {pin.repo_data?.trend_label && (
                          <span style={{ fontSize: "10px", fontWeight: 700, color: TREND_COLORS[pin.repo_data.trend_label] }}>
                            {pin.repo_data.trend_label}
                          </span>
                        )}
                        {/* Stage selector */}
                        <select
                          value={pin.stage}
                          onChange={(e) => handleUpdatePinStage(pin.id, e.target.value)}
                          style={{
                            marginLeft: "auto", fontFamily: "var(--font-sans)", fontSize: "11px", fontWeight: 600,
                            background: "var(--bg-surface)", color: "var(--text-secondary)",
                            border: "1px solid var(--border)", borderRadius: "6px", padding: "3px 8px", cursor: "pointer",
                          }}
                        >
                          {Object.entries(STAGE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                      </div>
                      {pin.note && (
                        <div style={{ fontFamily: "var(--font-sans)", fontSize: "11px", color: "var(--text-muted)", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "6px", padding: "6px 10px", fontStyle: "italic" }}>
                          {pin.note}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        </div>

        {/* ── RIGHT: Chat panel (35%) ──────────────────────────────────────── */}
        <div className="research-chat-panel" style={{
          flex: "0 0 35%", display: "flex", flexDirection: "column", overflow: "hidden",
          background: "var(--bg-surface)",
        }}>
          {/* Messages */}
          <div style={{ flex: 1, overflow: "auto", padding: "16px 14px", display: "flex", flexDirection: "column", gap: "14px" }}>
            {/* Welcome */}
            {messages.length === 0 && !sending && (
              <div style={{
                background: "var(--bg-elevated)", border: "1px solid var(--border)",
                borderRadius: "12px", padding: "16px",
                fontFamily: "var(--font-sans)", fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.6,
              }}>
                <strong style={{ color: "var(--accent-blue)" }}>🤖 Research Agent</strong><br />
                Hi! Ask me anything about GitHub repositories — from layman terms to precise technical filters. All data is fetched live from GitHub.
                <div style={{ marginTop: "10px", fontFamily: "var(--font-sans)", fontSize: "11px", color: "var(--text-muted)" }}>
                  Try: <em>"what's trending in AI agents?"</em> or <em>"compare vllm vs llama.cpp"</em>
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <ChatBubble key={msg.id} msg={msg} onPin={handlePin} pinnedNames={pinnedNames} sessionId={sessionId} userId={userId} />
            ))}

            {/* Streaming bubble */}
            {sending && (
              <StreamingBubble
                text={streamText}
                repos={streamRepos}
                status={streamStatus}
                queryExplanation={streamQueryExp}
              />
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Follow-up suggestions */}
          {followUps.length > 0 && !sending && (
            <div style={{
              display: "flex", gap: "6px", padding: "8px 14px", flexWrap: "wrap",
              borderTop: "1px solid var(--border)", background: "var(--bg-surface)",
            }}>
              {followUps.map((f) => (
                <button
                  key={f}
                  onClick={() => { setInput(f); inputRef.current?.focus(); }}
                  style={{
                    fontFamily: "var(--font-sans)", fontSize: "11px", fontWeight: 500,
                    padding: "4px 10px", borderRadius: "12px", border: "1px solid var(--border)",
                    cursor: "pointer", background: "var(--bg-elevated)", color: "var(--text-muted)",
                    transition: "all 0.13s",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--accent-blue)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--accent-blue)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; }}
                >
                  💡 {f}
                </button>
              ))}
            </div>
          )}

          {/* Input bar */}
          <div style={{
            borderTop: "1px solid var(--border)", padding: "12px 14px",
            display: "flex", gap: "8px", flexShrink: 0, background: "var(--bg-surface)",
          }}>
            <textarea
              ref={inputRef}
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything… layman or technical (Enter to send, Shift+Enter for newline)"
              disabled={sending}
              style={{
                flex: 1, resize: "none", fontFamily: "var(--font-sans)", fontSize: "13px",
                color: "var(--text-primary)", background: "var(--bg-elevated)",
                border: "1px solid var(--border)", borderRadius: "8px", padding: "10px 12px",
                outline: "none", lineHeight: 1.5, transition: "border-color 0.13s",
                opacity: sending ? 0.7 : 1,
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent-blue)"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
            />
            <button
              onClick={() => handleSend()}
              disabled={sending || !input.trim()}
              style={{
                alignSelf: "flex-end",
                background: "var(--accent-blue)", color: "#fff",
                border: "none", borderRadius: "8px",
                width: "40px", height: "40px",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: sending || !input.trim() ? "not-allowed" : "pointer",
                opacity: sending || !input.trim() ? 0.5 : 1,
                fontSize: "18px", flexShrink: 0,
                transition: "opacity 0.13s, transform 0.1s",
              }}
              onMouseDown={(e) => { if (!sending && input.trim()) (e.currentTarget as HTMLElement).style.transform = "scale(0.9)"; }}
              onMouseUp={(e) => { (e.currentTarget as HTMLElement).style.transform = "scale(1)"; }}
            >
              ↑
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
