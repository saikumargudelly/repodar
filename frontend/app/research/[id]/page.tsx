"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import ReactMarkdown from "react-markdown";
import { api, ResearchMessage, ResearchPin, ResearchRepo, ResearchSession } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";

function MD({ children }: { children: string }) {
  return <ReactMarkdown>{children}</ReactMarkdown>;
}

const C = {
  bg: "var(--bg-primary)",
  bgCard: "var(--bg-surface)",
  bgHover: "var(--bg-elevated)",
  border: "var(--border)",
  text: "var(--text-primary)",
  textSub: "var(--text-secondary)",
  textMuted: "var(--text-muted)",
  green: "var(--accent-green)",
  amber: "var(--accent-yellow)",
  red: "var(--accent-red)",
};

const TREND_COLORS: Record<string, string> = {
  HIGH: C.green,
  MID: C.amber,
  LOW: C.red,
};

const STAGE_LABELS: Record<string, string> = {
  watch: "📡 Watch",
  evaluate: "🔍 Evaluate",
  track: "📈 Track",
  dismiss: "✕ Dismiss",
};

const VOICE_SILENCE_MS = 1300;
const VOICE_MAX_RECORDING_MS = 25000;
const VOICE_LEVEL_THRESHOLD = 0.014;

// ─── Sub-components ───────────────────────────────────────────────────────────

function RepoCard({
  repo,
  onPin,
  isPinned,
  onAddToReport,
  sessionId,
}: {
  repo: ResearchRepo;
  onPin: (r: ResearchRepo) => void;
  isPinned: boolean;
  onAddToReport?: (r: ResearchRepo) => void;
  sessionId?: string;
}) {
  const router = useRouter();
  const { getToken } = useAuth();
  const starsK = repo.stars >= 1000 ? `${(repo.stars / 1000).toFixed(1)}k` : String(repo.stars);
  const [blogOpen, setBlogOpen] = useState(false);
  const [blogPlatform, setBlogPlatform] = useState<"reddit"|"twitter"|"linkedin">("reddit");
  const [blogContent, setBlogContent] = useState("");
  const [generatingBlog, setGeneratingBlog] = useState(false);
  const [blogCopied, setBlogCopied] = useState(false);

  const handleGenerateBlog = async () => {
    if (!sessionId) return;
    setGeneratingBlog(true);
    setBlogContent("");
    try {
      const token = await getToken();
      if (!token) throw new Error("No authentication token available");
      const result = await api.research.generateBlog(sessionId, token, blogPlatform, repo as unknown as Record<string, unknown>);
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
      background: C.bgCard,
      border: `1px solid ${C.border}`,
      borderLeft: `3px solid ${TREND_COLORS[repo.trend_label] ?? C.border}`,
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
          style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: "13px", color: C.text, textDecoration: "underline", lineHeight: 1.3 }}
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

      <div style={{ fontFamily: "var(--font-sans)", fontSize: "11px", color: C.textSub, lineHeight: 1.4 }}>
        {repo.description?.slice(0, 100) || "No description"}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontFamily: "var(--font-mono, monospace)", fontSize: "11px", color: C.textSub }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
          {starsK}
        </span>
        {repo.primary_language && (
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "11px", color: C.textSub }}>• {repo.primary_language}</span>
        )}
        {repo.topics?.slice(0, 2).map((t) => (
          <span key={t} style={{ fontFamily: "var(--font-sans)", fontSize: "10px", color: C.textSub, background: C.bgHover, border: `1px solid ${C.border}`, borderRadius: "4px", padding: "1px 6px" }}>
            {t}
          </span>
        ))}
      </div>

      {/* Confidence and Risk Row */}
      {(repo.confidence_score !== undefined || repo.risk_score !== undefined) && (
        <div style={{ display: "flex", gap: "10px", alignItems: "center", margin: "4px 0", flexWrap: "wrap" }}>
          {repo.confidence_score !== undefined && (
            <div
              title={repo.confidence_reason}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                fontSize: "11px",
                fontFamily: "var(--font-sans)",
                fontWeight: 600,
                color: repo.confidence_level === "High" ? "#3fb950" : repo.confidence_level === "Medium" ? "#e3b341" : "#f85149",
                background: repo.confidence_level === "High" ? "rgba(63,185,80,0.1)" : repo.confidence_level === "Medium" ? "rgba(227,179,65,0.1)" : "rgba(248,81,73,0.1)",
                border: `1px solid ${repo.confidence_level === "High" ? "rgba(63,185,80,0.2)" : repo.confidence_level === "Medium" ? "rgba(227,179,65,0.2)" : "rgba(248,81,73,0.2)"}`,
                borderRadius: "6px",
                padding: "2px 8px",
                cursor: "help",
              }}
            >
              🛡️ Confidence: {repo.confidence_score}% ({repo.confidence_level})
            </div>
          )}

          {repo.risk_score !== undefined && (
            <div
              title={repo.risk_factors && repo.risk_factors.length > 0 ? `Risk Factors:\n- ${repo.risk_factors.join("\n- ")}` : "No risk factors detected"}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                fontSize: "11px",
                fontFamily: "var(--font-sans)",
                fontWeight: 600,
                color: repo.risk_score >= 50 ? "#f85149" : repo.risk_score >= 20 ? "#e3b341" : C.textSub,
                background: repo.risk_score >= 50 ? "rgba(248,81,73,0.1)" : repo.risk_score >= 20 ? "rgba(227,179,65,0.1)" : C.bgHover,
                border: `1px solid ${repo.risk_score >= 50 ? "rgba(248,81,73,0.2)" : repo.risk_score >= 20 ? "rgba(227,179,65,0.2)" : C.border}`,
                borderRadius: "6px",
                padding: "2px 8px",
                cursor: repo.risk_factors && repo.risk_factors.length > 0 ? "help" : "default",
              }}
            >
              ⚠️ Risk Score: {repo.risk_score}/100
            </div>
          )}
        </div>
      )}

      {/* Citations and QA Badges */}
      {(repo.has_ci_cd || repo.has_tests || (repo.evidence_citations && repo.evidence_citations.length > 0)) && (
        <details style={{ marginTop: "4px", width: "100%" }}>
          <summary style={{
            fontSize: "11px",
            fontFamily: "var(--font-sans)",
            color: C.textSub,
            cursor: "pointer",
            userSelect: "none",
            fontWeight: 600,
            outline: "none",
          }}>
            📋 Analysis & QA Evidence ({repo.evidence_citations?.length || 0})
          </summary>
          <div style={{
            marginTop: "6px",
            padding: "8px 10px",
            background: C.bgHover,
            border: `1px solid ${C.border}`,
            borderRadius: "6px",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
          }}>
            {/* Badges */}
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              {repo.has_ci_cd && (
                <span style={{ fontSize: "10px", fontWeight: 700, background: "rgba(56,139,253,0.15)", color: "#58a6ff", border: "1px solid rgba(56,139,253,0.3)", borderRadius: "4px", padding: "1px 6px" }}>
                  ✓ CI/CD ACTIVE
                </span>
              )}
              {repo.has_tests && (
                <span style={{ fontSize: "10px", fontWeight: 700, background: "rgba(56,139,253,0.15)", color: "#58a6ff", border: "1px solid rgba(56,139,253,0.3)", borderRadius: "4px", padding: "1px 6px" }}>
                  ✓ TEST SUITE
                </span>
              )}
              {repo.license_category && (
                <span style={{ fontSize: "10px", fontWeight: 700, background: C.bgCard, color: C.textSub, border: `1px solid ${C.border}`, borderRadius: "4px", padding: "1px 6px" }}>
                  LICENSE: {repo.license_category.toUpperCase()}
                </span>
              )}
            </div>
            {/* Citations List */}
            {repo.evidence_citations && repo.evidence_citations.length > 0 && (
              <ul style={{ margin: 0, paddingLeft: "16px", fontSize: "10.5px", fontFamily: "var(--font-sans)", color: C.textSub, lineHeight: 1.4 }}>
                {repo.evidence_citations.map((cit, idx) => (
                  <li key={idx} style={{ marginBottom: "2px" }}>{cit}</li>
                ))}
              </ul>
            )}
          </div>
        </details>
      )}

      <div style={{ display: "flex", gap: "6px", marginTop: "2px", flexWrap: "wrap" }}>
        <button
          onClick={() => onPin(repo)}
          style={{
            fontFamily: "var(--font-sans)", fontSize: "11px", fontWeight: 600,
            padding: "4px 10px", borderRadius: "6px", border: `1px solid ${isPinned ? C.text : C.border}`,
            cursor: "pointer", transition: "all 0.13s",
            background: isPinned ? C.text : C.bgHover,
            color: isPinned ? C.bg : C.textSub,
          }}
        >
          {isPinned ? "📌 Pinned" : "📌 Pin"}
        </button>

        {/* Internal detail navigation */}
        <button
          onClick={() => router.push(`/repo/${repo.full_name}`)}
          style={{
            fontFamily: "var(--font-sans)", fontSize: "11px", fontWeight: 600,
            padding: "4px 10px", borderRadius: "6px", border: `1px solid ${C.border}`,
            cursor: "pointer", background: C.bgHover, color: C.textSub,
            transition: "all 0.13s",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = C.text; (e.currentTarget as HTMLElement).style.borderColor = C.textSub; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = C.textSub; (e.currentTarget as HTMLElement).style.borderColor = C.border; }}
        >
          📊 Details
        </button>

        {/* Blog/Social post generator */}
        <button
          onClick={() => setBlogOpen(!blogOpen)}
          style={{
            fontFamily: "var(--font-sans)", fontSize: "11px", fontWeight: 600,
            padding: "4px 10px", borderRadius: "6px", border: `1px solid ${blogOpen ? C.textSub : C.border}`,
            cursor: "pointer", background: blogOpen ? C.bgHover : C.bgCard,
            color: blogOpen ? C.text : C.textSub,
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
              padding: "4px 10px", borderRadius: "6px", border: `1px solid ${C.border}`,
              cursor: "pointer", background: C.bgHover, color: C.textSub,
              transition: "all 0.13s",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = C.text; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = C.textSub; }}
          >
            → Report
          </button>
        )}
      </div>

      {/* Blog generator inline panel */}
      {blogOpen && (
        <div style={{
          marginTop: "8px", padding: "12px", borderRadius: "8px",
          background: C.bgHover, border: `1px solid ${C.border}`,
          display: "flex", flexDirection: "column", gap: "8px",
        }}>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: "11px", fontWeight: 600, color: C.textSub }}>✍️ Generate social post for {repo.name}</div>
          {/* Platform selector tabs */}
          <div style={{ display: "flex", gap: "4px" }}>
            {PLATFORMS.map(p => (
              <button key={p.key} onClick={() => setBlogPlatform(p.key)} style={{
                fontFamily: "var(--font-sans)", fontSize: "10px", fontWeight: 600,
                padding: "3px 8px", borderRadius: "5px",
                border: `1px solid ${blogPlatform === p.key ? C.textSub : C.border}`,
                background: blogPlatform === p.key ? C.bgHover : "transparent",
                color: blogPlatform === p.key ? C.text : C.textSub,
                cursor: "pointer",
              }}>{p.icon} {p.label}</button>
            ))}
          </div>
          <button
            onClick={handleGenerateBlog}
            disabled={generatingBlog}
            style={{
              fontFamily: "var(--font-sans)", fontSize: "11px", fontWeight: 600,
              padding: "5px 12px", borderRadius: "6px", border: `1px solid ${C.border}`,
              cursor: generatingBlog ? "wait" : "pointer",
              background: generatingBlog ? C.bgHover : C.text,
              color: generatingBlog ? C.textSub : C.bg,
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
                  color: C.text, background: C.bgCard,
                  border: `1px solid ${C.border}`, borderRadius: "6px", padding: "8px 10px",
                  lineHeight: 1.5,
                }}
              />
              <button
                onClick={handleCopyBlog}
                style={{
                  position: "absolute", top: "6px", right: "8px",
                  fontFamily: "var(--font-sans)", fontSize: "10px", fontWeight: 600,
                  padding: "3px 8px", borderRadius: "4px",
                  border: `1px solid ${C.border}`,
                  background: blogCopied ? "rgba(63,185,80,0.15)" : C.bgHover,
                  color: blogCopied ? C.green : C.textSub,
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
}: {
  msg: ResearchMessage;
  onPin: (r: ResearchRepo) => void;
  pinnedNames: Set<string>;
  sessionId: string;
}) {
  const isUser = msg.role === "user";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px", alignItems: isUser ? "flex-end" : "flex-start" }}>
      {/* Query explanation (agent only) */}
      {!isUser && msg.query_explanation && (
        <div style={{
          fontFamily: "var(--font-sans)", fontSize: "11px", color: C.textSub,
          display: "flex", alignItems: "center", gap: "6px",
          padding: "4px 10px", background: C.bgCard, borderRadius: "6px",
          border: `1px solid ${C.border}`, maxWidth: "90%",
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <em>{msg.query_explanation}</em>
        </div>
      )}

      {/* Bubble */}
      <div style={{
        maxWidth: "92%",
        background: isUser ? C.bgHover : C.bgCard,
        color: C.text,
        border: `1px solid ${C.border}`,
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
            <RepoCard key={r.full_name} repo={r} onPin={onPin} isPinned={pinnedNames.has(r.full_name)} sessionId={sessionId} />
          ))}
          {msg.repos.length > 8 && (
            <div style={{ fontFamily: "var(--font-sans)", fontSize: "11px", color: C.textSub, padding: "4px 8px" }}>
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
          fontFamily: "var(--font-sans)", fontSize: "11px", color: C.textSub,
          display: "flex", alignItems: "center", gap: "6px",
          padding: "4px 10px", background: C.bgCard, borderRadius: "6px",
          border: `1px solid ${C.border}`, maxWidth: "90%",
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <em>{queryExplanation}</em>
        </div>
      )}
      {status && !text && (
        <div style={{
          fontFamily: "var(--font-sans)", fontSize: "12px", color: C.textSub,
          display: "flex", alignItems: "center", gap: "8px",
          padding: "8px 14px", background: C.bgCard, border: `1px solid ${C.border}`,
          borderRadius: "14px 14px 14px 4px",
        }}>
          <div className="rasengan-indicator" title="Rasengan Chakra Sphere typing indicator">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="2" fill="#378ADD" className="rasengan-center" />
              <g className="rasengan-inner">
                <circle cx="12" cy="12" r="5.5" stroke="rgba(255,255,255,0.35)" strokeWidth="1" strokeDasharray="6 3 2 3" />
              </g>
              <g className="rasengan-outer">
                <circle cx="12" cy="12" r="9.5" stroke="#378ADD" strokeWidth="1.5" strokeDasharray="10 4 2 4" />
              </g>
            </svg>
          </div>
          {status}
        </div>
      )}
      {text && (
        <div style={{
          maxWidth: "92%", background: C.bgCard, color: C.text,
          border: `1px solid ${C.border}`, borderRadius: "14px 14px 14px 4px",
          padding: "10px 14px", fontFamily: "var(--font-sans)", fontSize: "13px", lineHeight: 1.6,
        }}>
          <div className="research-md"><MD>{text}</MD></div>
          <span style={{ display: "inline-block", width: "2px", height: "14px", background: C.textSub, verticalAlign: "middle", animation: "blink 0.7s step-end infinite", marginLeft: "2px" }} />
        </div>
      )}
      {repos.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", paddingLeft: "4px" }}>
          {repos.slice(0, 5).map((r) => (
            <div key={r.full_name} style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: "8px", padding: "10px 12px", fontFamily: "var(--font-sans)", fontSize: "12px", color: C.textSub }}>
              <strong style={{ color: C.text }}>{r.full_name}</strong> — {(r.stars / 1000).toFixed(1)}k 
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ display: "inline-block", margin: "0 4px", verticalAlign: "middle" }}>
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              · {r.trend_label} · {r.description?.slice(0, 60)}
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
  const { userId, isLoaded, getToken } = useAuth();
  const { showToast } = useToast();

  // Session state
  const [title, setTitle] = useState("Untitled Research");
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [sessions, setSessions] = useState<ResearchSession[]>([]);
  const [creating, setCreating] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);

  // Chat state
  const [messages, setMessages] = useState<ResearchMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [streamRepos, setStreamRepos] = useState<ResearchRepo[]>([]);
  const [streamStatus, setStreamStatus] = useState("");
  const [streamQueryExp, setStreamQueryExp] = useState("");
  const [followUps, setFollowUps] = useState<string[]>([]);
  const [sttSupported, setSttSupported] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [sttStatus, setSttStatus] = useState("");

  // Report / pins state
  const [pins, setPins] = useState<ResearchPin[]>([]);
  const [reportMd, setReportMd] = useState<string | null>(null);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [activePanel, setActivePanel] = useState<"report" | "pins">("report");
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);

  // Responsive state
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
      setIsTablet(window.innerWidth > 768 && window.innerWidth <= 1024);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const esRef = useRef<EventSource | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordingTimerRef = useRef<number | null>(null);
  const voiceRafRef = useRef<number | null>(null);
  const silenceStartRef = useRef<number | null>(null);
  const hasSpokenRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);

  const stopRecordingTimer = useCallback(() => {
    if (recordingTimerRef.current !== null) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  }, []);

  const stopVoiceDetection = useCallback(() => {
    if (voiceRafRef.current !== null) {
      window.cancelAnimationFrame(voiceRafRef.current);
      voiceRafRef.current = null;
    }
    silenceStartRef.current = null;
    hasSpokenRef.current = false;

    if (audioContextRef.current) {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }
  }, []);

  const stopMediaTracks = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
  }, []);

  // Load session
  useEffect(() => {
    if (!isLoaded) return;
    getToken().then((token) => {
      if (!token) return;
      api.research.listSessions(token).then(setSessions).catch(console.error);
      api.research.getSession(sessionId, token).then((data) => {
        setTitle(data.title);
        setTitleDraft(data.title);
        setMessages(data.messages);
        setPins(data.pins);
        if (data.report) setReportMd(data.report.content_md);
      }).catch(console.error);
    }).catch(console.error);
  }, [isLoaded, sessionId, getToken]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const token = await getToken();
      if (!token) throw new Error("No authentication token available");
      const s = await api.research.createSession(token, "Untitled Research");
      router.push(`/research/${s.id}`);
    } catch (e) {
      console.error(e);
      setCreating(false);
    }
  };

  const handleDeleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this research session?")) return;
    try {
      const token = await getToken();
      if (!token) throw new Error("No authentication token available");
      await api.research.deleteSession(id, token);
      setSessions((prev) => prev.filter((s) => s.id !== id));
      if (id === sessionId) {
        router.push("/research");
      }
    } catch (e) {
      console.error(e);
    }
  };

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

  useEffect(() => {
    setSttSupported(
      typeof window !== "undefined" &&
      typeof MediaRecorder !== "undefined" &&
      !!navigator.mediaDevices?.getUserMedia &&
      typeof AudioContext !== "undefined",
    );
  }, []);

  useEffect(() => {
    return () => {
      if (esRef.current) {
        esRef.current.close();
      }

      const activeRecorder = recorderRef.current;
      if (activeRecorder && activeRecorder.state !== "inactive") {
        activeRecorder.onstop = null;
        activeRecorder.stop();
      }

      stopRecordingTimer();
      stopVoiceDetection();
      stopMediaTracks();
    };
  }, [stopMediaTracks, stopRecordingTimer, stopVoiceDetection]);

  const pinnedNames = useMemo(() => new Set(pins.map((p) => p.repo_full_name)), [pins]);

  // ── Pin a repo ──────────────────────────────────────────────────────────────
  const handlePin = useCallback(async (repo: ResearchRepo) => {
    if (pinnedNames.has(repo.full_name)) return;
    try {
      const token = await getToken();
      if (!token) throw new Error("No authentication token available");
      const pin = await api.research.pinRepo(
        sessionId, token, repo.full_name, repo as unknown as Record<string, unknown>
      );
      setPins((prev) => [...prev, pin]);
    } catch (e) { console.error(e); }
  }, [sessionId, getToken, pinnedNames]);

  const handleUnpin = async (pinId: string) => {
    try {
      const token = await getToken();
      if (!token) throw new Error("No authentication token available");
      await api.research.unpinRepo(sessionId, token, pinId);
      setPins((prev) => prev.filter((p) => p.id !== pinId));
    } catch (e) { console.error(e); }
  };

  const handleUpdatePinStage = async (pinId: string, stage: string) => {
    try {
      const token = await getToken();
      if (!token) throw new Error("No authentication token available");
      const updated = await api.research.updatePin(sessionId, token, pinId, { stage });
      setPins((prev) => prev.map((p) => (p.id === pinId ? updated : p)));
    } catch (e) { console.error(e); }
  };

  // ── Send message via SSE ────────────────────────────────────────────────────
  const handleSend = useCallback(async (overrideInput?: string) => {
    const text = (overrideInput ?? input).trim();
    if (!text || sending) return;

    const token = await getToken();
    if (!token) {
      showToast("Authentication token missing. Please sign in again.", "error");
      return;
    }

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

    const url = api.research.streamUrl(sessionId, token, text);
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

          // Auto-name title on frontend if it is default (case-insensitive and trimmed)
          const queryExp = (doneMeta.query_explanation as string) ?? streamQueryExp;
          if (title && title.trim().toLowerCase() === "untitled research" && queryExp) {
            let cleaned = queryExp.replace(/^(searching for|search for|comparing|compare|landscape mapping of|landscape of)\s+/i, '');
            cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
            cleaned = cleaned.substring(0, 50);
            setTitle(cleaned);

            // Persist the auto-named title to the backend database and update the sessions list (sidebar)
            getToken().then((token) => {
              if (!token) return;
              api.research.updateSession(sessionId, token, { title: cleaned })
                .then(() => {
                  setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, title: cleaned } : s));
                })
                .catch(console.error);
            }).catch(console.error);
          }

          // Persist streamed message in UI
          const agentMsg: ResearchMessage = {
            id: `streamed-${Date.now()}`,
            role: "agent",
            content: accText || (typeof data === "string" ? data : ""),
            intent: (doneMeta.intent as string) ?? null,
            github_query: (doneMeta.github_query as string) ?? null,
            query_explanation: queryExp,
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
  }, [input, getToken, sending, sessionId, streamQueryExp, title]);

  const transcribeAudioBlob = useCallback(async (audioBlob: Blob, mimeType: string) => {
    setIsTranscribing(true);
    setSttStatus("Transcribing…");

    try {
      const ext = mimeType.includes("ogg")
        ? "ogg"
        : mimeType.includes("mp4") || mimeType.includes("m4a")
          ? "m4a"
          : mimeType.includes("wav")
            ? "wav"
            : "webm";

      const token = await getToken();
      if (!token) throw new Error("No authentication token available");
      const transcript = await api.research.transcribeSpeech(
        token,
        audioBlob,
        `voice-${Date.now()}.${ext}`,
      );

      const text = transcript.text?.trim();
      if (!text) {
        setSttStatus("No speech detected. Please try again.");
        return;
      }

      setSttStatus("Sending your request…");
      handleSend(text);
      window.setTimeout(() => setSttStatus(""), 900);
    } catch (e: unknown) {
      setSttStatus((e as Error)?.message ?? "Speech transcription failed.");
    } finally {
      setIsTranscribing(false);
    }
  }, [handleSend, getToken]);

  const startVoiceDetection = useCallback((stream: MediaStream, recorder: MediaRecorder) => {
    if (typeof AudioContext === "undefined") {
      return;
    }

    stopVoiceDetection();

    const context = new AudioContext();
    audioContextRef.current = context;

    const source = context.createMediaStreamSource(stream);
    const analyser = context.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.15;
    source.connect(analyser);

    const samples = new Float32Array(analyser.fftSize);
    const startedAt = performance.now();
    silenceStartRef.current = null;
    hasSpokenRef.current = false;

    void context.resume().catch(() => {
      // Keep recording without silence auto-stop if resume fails.
    });

    const monitorLevel = () => {
      if (recorder.state !== "recording") {
        return;
      }

      analyser.getFloatTimeDomainData(samples);
      let sumSquares = 0;
      for (let i = 0; i < samples.length; i += 1) {
        const value = samples[i];
        sumSquares += value * value;
      }
      const rms = Math.sqrt(sumSquares / samples.length);
      const now = performance.now();

      if (rms >= VOICE_LEVEL_THRESHOLD) {
        hasSpokenRef.current = true;
        silenceStartRef.current = null;
      } else if (hasSpokenRef.current) {
        if (silenceStartRef.current === null) {
          silenceStartRef.current = now;
        }

        const silentForMs = now - silenceStartRef.current;
        if (silentForMs >= VOICE_SILENCE_MS && now - startedAt >= 800) {
          setSttStatus("Silence detected. Finishing up…");
          recorder.stop();
          return;
        }
      }

      if (now - startedAt >= VOICE_MAX_RECORDING_MS) {
        setSttStatus("Max voice length reached. Finishing up…");
        recorder.stop();
        return;
      }

      voiceRafRef.current = window.requestAnimationFrame(monitorLevel);
    };

    voiceRafRef.current = window.requestAnimationFrame(monitorLevel);
  }, [stopVoiceDetection]);

  const handleToggleRecording = useCallback(async () => {
    if (sending || isTranscribing) {
      return;
    }

    if (!sttSupported) {
      setSttStatus("Voice input is not supported in this browser.");
      return;
    }

    if (isRecording) {
      const activeRecorder = recorderRef.current;
      if (activeRecorder && activeRecorder.state !== "inactive") {
        setSttStatus("Processing your voice…");
        activeRecorder.stop();
      }
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const candidates = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/ogg;codecs=opus",
      ];
      const chosenMime = candidates.find((candidate) => {
        try {
          return MediaRecorder.isTypeSupported(candidate);
        } catch {
          return false;
        }
      });

      const recorder = chosenMime
        ? new MediaRecorder(stream, { mimeType: chosenMime })
        : new MediaRecorder(stream);

      recordingChunksRef.current = [];

      recorder.ondataavailable = (evt: BlobEvent) => {
        if (evt.data.size > 0) {
          recordingChunksRef.current.push(evt.data);
        }
      };

      recorder.onerror = () => {
        setSttStatus("Recording failed. Please retry.");
        setIsRecording(false);
        stopRecordingTimer();
        stopVoiceDetection();
        stopMediaTracks();
      };

      recorder.onstop = async () => {
        const chunks = recordingChunksRef.current;
        recordingChunksRef.current = [];
        const recordedType = recorder.mimeType || "audio/webm";

        setIsRecording(false);
        stopRecordingTimer();
        stopVoiceDetection();
        stopMediaTracks();

        if (!chunks.length) {
          setSttStatus("No audio captured. Try again.");
          return;
        }

        const audioBlob = new Blob(chunks, { type: recordedType });
        if (audioBlob.size < 1024) {
          setSttStatus("Recording was too short. Try again.");
          return;
        }

        await transcribeAudioBlob(audioBlob, recordedType);
      };

      recorderRef.current = recorder;
      recorder.start(250);

      setRecordingSeconds(0);
      setIsRecording(true);
      setSttStatus("Listening… auto-sends when you stop talking");

      stopRecordingTimer();
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingSeconds((seconds) => seconds + 1);
      }, 1000);

      startVoiceDetection(stream, recorder);
    } catch {
      setSttStatus("Microphone permission denied or unavailable.");
      setIsRecording(false);
      stopRecordingTimer();
      stopVoiceDetection();
      stopMediaTracks();
    }
  }, [
    isRecording,
    isTranscribing,
    sending,
    startVoiceDetection,
    stopMediaTracks,
    stopRecordingTimer,
    stopVoiceDetection,
    sttSupported,
    transcribeAudioBlob,
  ]);

  // ── Generate report ─────────────────────────────────────────────────────────
  const handleGenReport = async () => {
    setGeneratingReport(true);
    try {
      const token = await getToken();
      if (!token) throw new Error("No authentication token available");
      const result = await api.research.generateReport(sessionId, token);
      setReportMd(result.content_md);
      setActivePanel("report");
    } catch (e: unknown) {
      showToast((e as Error).message ?? "Failed to generate report.", "error");
    } finally {
      setGeneratingReport(false);
    }
  };

  // ── Share ───────────────────────────────────────────────────────────────────
  const handleShare = async () => {
    setSharing(true);
    try {
      const token = await getToken();
      if (!token) throw new Error("No authentication token available");
      const { token: shareToken } = await api.research.createShare(sessionId, token, 7);
      const link = `${window.location.origin}/research/share/${shareToken}`;
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e: unknown) {
      showToast((e as Error).message ?? "Failed to create share link.", "error");
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
    const trimmed = titleDraft.trim();
    if (!trimmed || trimmed === title) { setEditingTitle(false); return; }
    try {
      const token = await getToken();
      if (!token) throw new Error("No authentication token available");
      await api.research.updateSession(sessionId, token, { title: trimmed });
      setTitle(trimmed);
      setEditingTitle(false);
    } catch (e) {
      console.error(e);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const QUICK_CHIPS = [
    {
      label: "AI/ML trends this week",
      q: "what's trending in AI and ML this week?",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: "6px" }}>
          <path d="M12 22a4 4 0 0 0 4-4V6a4 4 0 1 0-8 0v12a4 4 0 0 0 4 4z" />
          <path d="M22 12a4 4 0 0 0-4-4H6a4 4 0 1 0 0 8h12a4 4 0 0 0 4-4z" />
        </svg>
      )
    },
    {
      label: "Security tools",
      q: "security tools gaining stars this month",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: "6px" }}>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <circle cx="12" cy="11" r="2" />
          <path d="M12 13v3" />
        </svg>
      )
    },
    {
      label: "Rust rising stars",
      q: "rust repos with high momentum",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: "6px" }}>
          <path d="M6 18V4h6a5 5 0 0 1 0 10H6" />
          <path d="M12 14l5 5" />
        </svg>
      )
    },
    {
      label: "Data infra",
      q: "map the data infrastructure ecosystem",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: "6px" }}>
          <rect x="3" y="4" width="18" height="6" rx="1" />
          <rect x="3" y="14" width="18" height="6" rx="1" />
          <path d="M6 10v4M18 10v4" />
        </svg>
      )
    }
  ];

  const handleChipClick = async (label: string, q: string) => {
    setCreating(true);
    try {
      const token = await getToken();
      if (!token) throw new Error("No authentication token available");
      const s = await api.research.createSession(token, label);
      router.push(`/research/${s.id}?q=${encodeURIComponent(q)}`);
    } catch (e) {
      console.error(e);
      setCreating(false);
    }
  };

  const pageHeight = isMobile ? "calc(100vh - 56px - 26px)" : "calc(100vh - 26px)";

  return (
    <div style={{ height: pageHeight, display: "flex", flexDirection: "column", background: C.bg, color: C.text, overflow: "hidden" }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes blink { 50%{opacity:0} }

        .research-md p { margin: 0 0 8px; }
        .research-md p:last-child { margin-bottom: 0; }
        .research-md ul, .research-md ol { padding-left: 20px; margin: 6px 0; }
        .research-md li { margin-bottom: 4px; }
        .research-md h1,.research-md h2,.research-md h3 { margin: 10px 0 6px; font-family: var(--font-sans); }
        .research-md code { background: rgba(230,237,243,0.1); padding: 1px 5px; border-radius: 4px; font-size: 12px; font-family: var(--font-mono, monospace); color: ${C.text}; }
        .research-md pre { background: ${C.bgCard}; border: 1px solid ${C.border}; border-radius: 6px; padding: 10px; margin: 8px 0; overflow-x: auto; }
        .research-md blockquote { border-left: 3px solid ${C.textSub}; padding-left: 12px; color: ${C.textSub}; margin: 6px 0; }
        .research-md strong { color: ${C.text}; }
        .research-md a { color: ${C.text}; text-decoration: underline; }
        .research-md a:hover { color: ${C.textSub}; }

        ::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        ::-webkit-scrollbar-track {
          background: transparent;
        }
        ::-webkit-scrollbar-thumb {
          background: #30363d;
          border-radius: 3px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #8b949e;
        }
      `}</style>

      {/* Global Header */}
      <div style={{
        height: "56px",
        background: C.bgCard,
        borderBottom: `1px solid ${C.border}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: isMobile ? "0 16px" : "0 24px",
        flexShrink: 0
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "20px" }}>🔬</span>
          <h1 style={{ fontFamily: "var(--font-sans)", fontSize: isMobile ? "14px" : "16px", fontWeight: 700, color: "#ffffff", margin: 0 }}>
            Research mode
          </h1>
          <span style={{
            background: C.bgHover,
            color: C.textSub,
            borderRadius: "10px",
            padding: isMobile ? "2px 6px" : "2px 8px",
            fontSize: "11px",
            fontWeight: 600,
            fontFamily: "var(--font-sans)",
            marginLeft: "4px"
          }}>
            β
          </span>
        </div>
        <button
          onClick={handleCreate}
          disabled={creating}
          style={{
            background: "transparent",
            border: `1px solid ${C.border}`,
            borderRadius: "8px",
            padding: isMobile ? "6px 12px" : "8px 16px",
            color: "#ffffff",
            fontSize: "13px",
            fontWeight: 600,
            fontFamily: "var(--font-sans)",
            cursor: creating ? "not-allowed" : "pointer",
            transition: "all 0.2s",
            opacity: creating ? 0.7 : 1,
          }}
          onMouseEnter={(e) => { if (!creating) { e.currentTarget.style.borderColor = C.textSub; e.currentTarget.style.background = C.bgHover; } }}
          onMouseLeave={(e) => { if (!creating) { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = "transparent"; } }}
        >
          {creating ? "Creating…" : "+ New research"}
        </button>
      </div>

      {/* Main Container */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>
        
        {/* Left Column (Sessions list + controls - hidden on mobile) */}
        {!isMobile && (
          <div style={{
            flex: isTablet ? "0 0 35%" : "0 0 42%",
            borderRight: `1px solid ${C.border}`,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            padding: "16px 20px 0 20px"
          }}>
            
            {/* Quick Start Chips */}
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "16px", flexShrink: 0 }}>
              {QUICK_CHIPS.map(({ label, q, icon }) => (
                <button
                  key={label}
                  onClick={() => handleChipClick(label, q)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "6px 14px",
                    borderRadius: "20px",
                    fontSize: "12px",
                    fontWeight: 600,
                    fontFamily: "var(--font-sans)",
                    cursor: "pointer",
                    transition: "all 0.15s",
                    border: `1px solid ${C.border}`,
                    color: C.textSub,
                    background: C.bgCard,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.textSub; e.currentTarget.style.color = C.text; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.textSub; }}
                >
                  {icon}
                  {label}
                </button>
              ))}
            </div>

            {/* Sessions List */}
            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "12px", paddingBottom: "20px" }}>
              {sessions.map((s) => {
                const active = sessionId === s.id;
                return (
                  <div
                    key={s.id}
                    onClick={() => router.push(`/research/${s.id}`)}
                    style={{
                      background: C.bgCard,
                      border: `1px solid ${active ? "#ffffff" : C.border}`,
                      borderRadius: "10px",
                      padding: "16px",
                      cursor: "pointer",
                      transition: "all 0.15s",
                      position: "relative",
                    }}
                    onMouseEnter={(e) => { if (!active) e.currentTarget.style.borderColor = C.textSub; }}
                    onMouseLeave={(e) => { if (!active) e.currentTarget.style.borderColor = C.border; }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", marginBottom: "8px" }}>
                      <div style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: "14px", color: C.text, lineHeight: 1.3 }}>
                        {s.title}
                      </div>
                      <button
                        onClick={(e) => handleDeleteSession(s.id, e)}
                        style={{
                          width: "24px",
                          height: "24px",
                          borderRadius: "6px",
                          border: `1px solid ${C.border}`,
                          background: "transparent",
                          color: C.textSub,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          fontSize: "14px",
                          lineHeight: 1,
                          flexShrink: 0,
                          transition: "all 0.15s",
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.textSub; e.currentTarget.style.color = C.text; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.textSub; }}
                        title="Delete session"
                      >
                        ✕
                      </button>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "4px" }}>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontFamily: "var(--font-sans)", fontSize: "12px", color: C.textSub }}>
                        <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: C.green, display: "inline-block" }} />
                        {s.message_count} messages
                      </div>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontFamily: "var(--font-sans)", fontSize: "12px", color: C.textSub }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: "2px" }}>
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                          <line x1="16" y1="2" x2="16" y2="6" />
                          <line x1="8" y1="2" x2="8" y2="6" />
                          <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                        {new Date(s.updated_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Right Column (Research Detail Panel) */}
        <div style={{
          flex: isMobile ? "0 0 100%" : isTablet ? "0 0 65%" : "0 0 58%",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          padding: isMobile ? "12px 12px 16px 12px" : "16px 20px 20px 20px"
        }}>
          
          {/* Chat Panel Card Container */}
          <div style={{
            flex: 1,
            background: C.bgCard,
            border: `1px solid ${C.border}`,
            borderRadius: "12px",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden"
          }}>
            
            {/* Panel Header */}
            <div style={{
              height: "56px", borderBottom: `1px solid ${C.border}`,
              display: "flex", alignItems: "center", padding: "0 16px",
              justifyContent: "space-between", flexShrink: 0,
              background: C.bgCard, gap: "12px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: C.textSub, flexShrink: 0 }}>
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M12 2v4M12 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
                  <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                </svg>
                {editingTitle ? (
                  <input
                    value={titleDraft}
                    onChange={(e) => setTitleDraft(e.target.value)}
                    onBlur={saveTitle}
                    onKeyDown={(e) => { if (e.key === "Enter") saveTitle(); if (e.key === "Escape") setEditingTitle(false); }}
                    autoFocus
                    style={{
                      fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: "14px",
                      color: C.text, background: C.bgHover,
                      border: `1px solid ${C.textSub}`, borderRadius: "6px",
                      padding: "3px 8px", outline: "none", minWidth: "200px",
                    }}
                  />
                ) : (
                  <span
                    onClick={() => { setTitleDraft(title); setEditingTitle(true); }}
                    title="Click to rename"
                    style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: "14px", color: C.text, cursor: "text", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                  >
                    {title}
                  </span>
                )}
              </div>

              {/* Actions: Report & Pinned */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginLeft: "auto", marginRight: "4px", flexShrink: 0 }}>
                {pins.length >= 3 && (
                  <button
                    onClick={handleGenReport}
                    disabled={generatingReport}
                    style={{
                      fontFamily: "var(--font-sans)", fontSize: "11px", fontWeight: 600,
                      padding: "5px 12px", borderRadius: "6px", border: `1px solid ${C.border}`,
                      cursor: generatingReport ? "not-allowed" : "pointer",
                      background: C.bgHover, color: C.text, transition: "all 0.13s",
                      opacity: generatingReport ? 0.7 : 1,
                    }}
                  >
                    {generatingReport ? "⏳ Report…" : "📄 Gen Report"}
                  </button>
                )}
                {reportMd && (
                  <button
                    onClick={() => setReportModalOpen(true)}
                    style={{
                      fontFamily: "var(--font-sans)", fontSize: "11px", fontWeight: 600,
                      padding: "5px 12px", borderRadius: "6px", border: `1px solid ${C.border}`,
                      cursor: "pointer", background: C.green + "15", color: C.green,
                    }}
                  >
                    📄 View Report
                  </button>
                )}
                <button
                  onClick={handleShare}
                  disabled={sharing}
                  style={{
                    fontFamily: "var(--font-sans)", fontSize: "11px", fontWeight: 600,
                    padding: "5px 12px", borderRadius: "6px", border: `1px solid ${C.border}`,
                    cursor: sharing ? "not-allowed" : "pointer",
                    background: copied ? "rgba(63,185,80,0.12)" : C.bgHover,
                    color: copied ? C.green : C.textSub,
                    transition: "all 0.15s",
                  }}
                >
                  {copied ? "✓ Copied!" : "🔗 Share"}
                </button>
              </div>
              
              {/* Close detail panel (navigates back to /research) */}
              <button
                onClick={() => router.push("/research")}
                style={{
                  width: "24px",
                  height: "24px",
                  borderRadius: "6px",
                  border: `1px solid ${C.border}`,
                  background: "transparent",
                  color: C.textSub,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.textSub; e.currentTarget.style.color = C.text; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.textSub; }}
                title="Close panel"
              >
                ✕
              </button>
            </div>

            {/* Panel Scrollable Body */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "16px" }}>
              
              {/* Subtitle */}
              {messages.length === 0 && !sending && (
                <div style={{ fontFamily: "var(--font-sans)", fontSize: "13px", color: C.textSub }}>
                  Ask anything about GitHub repos — live data, no hallucination.
                </div>
              )}

              {/* Quick Suggestion Pills */}
              {messages.length === 0 && !sending && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "8px", marginBottom: "8px" }}>
                  {[
                    {
                      label: "Trending in AI agents",
                      q: "what's trending in AI agents?",
                      icon: (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: "6px" }}>
                          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                          <polyline points="17 6 23 6 23 12" />
                        </svg>
                      )
                    },
                    {
                      label: "Compare vllm vs llama.cpp",
                      q: "compare vllm vs llama.cpp",
                      icon: (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: "6px" }}>
                          <path d="M7 16V4M7 4L3 8M7 4l4 4" />
                          <path d="M17 8v12M17 20l-4-4M17 20l4-4" />
                        </svg>
                      )
                    },
                    {
                      label: "Top Rust repos",
                      q: "top rust repositories",
                      icon: (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: "6px" }}>
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                      )
                    },
                  ].map(({ label, q, icon }) => (
                    <button
                      key={label}
                      onClick={() => handleSend(q)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        padding: "6px 14px",
                        borderRadius: "20px",
                        fontSize: "12px",
                        fontWeight: 600,
                        fontFamily: "var(--font-sans)",
                        cursor: "pointer",
                        transition: "all 0.15s",
                        border: `1px solid ${C.border}`,
                        color: C.textSub,
                        background: C.bgHover,
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.textSub; e.currentTarget.style.color = C.text; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.textSub; }}
                    >
                      {icon}
                      {label}
                    </button>
                  ))}
                </div>
              )}

              {/* Message History */}
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {messages.map((msg) => (
                  <ChatBubble key={msg.id} msg={msg} onPin={handlePin} pinnedNames={pinnedNames} sessionId={sessionId} />
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
            </div>

            {/* Input Panel */}
            <div style={{ borderTop: `1px solid ${C.border}`, padding: "12px", display: "flex", flexDirection: "column", gap: "10px", background: C.bgCard }}>
              
              <div style={{ display: "flex", gap: "8px" }}>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px" }}>
                  <textarea
                    ref={inputRef}
                    rows={2}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask layman or technical..."
                    disabled={sending || isTranscribing}
                    style={{
                      width: "100%", resize: "none", fontFamily: "var(--font-sans)", fontSize: "13px",
                      color: C.text, background: C.bgHover,
                      border: `1px solid ${C.border}`, borderRadius: "8px", padding: "10px 12px",
                      outline: "none", lineHeight: 1.5, transition: "border-color 0.13s",
                      opacity: sending || isTranscribing ? 0.7 : 1,
                    }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = "#218bff"; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = C.border; }}
                  />
                  {(sttStatus || isRecording) && (
                    <div style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "11px",
                      color: isRecording ? C.red : C.textSub,
                      minHeight: "16px",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}>
                      {isRecording && (
                        <span style={{
                          display: "inline-block",
                          width: "8px",
                          height: "8px",
                          borderRadius: "999px",
                          background: C.red,
                          animation: "pulse 1s ease infinite",
                        }} />
                      )}
                      {sttStatus}
                      {isRecording && <span style={{ color: C.textSub }}>{recordingSeconds}s</span>}
                    </div>
                  )}
                </div>
                <button
                  onClick={handleToggleRecording}
                  disabled={!sttSupported || sending || isTranscribing}
                  style={{
                    alignSelf: "flex-end",
                    background: isRecording ? C.red : C.bgHover,
                    color: isRecording ? "#fff" : C.textSub,
                    border: `1px solid ${isRecording ? C.red : C.border}`,
                    borderRadius: "8px",
                    width: "40px",
                    height: "40px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: !sttSupported || sending || isTranscribing ? "not-allowed" : "pointer",
                    opacity: !sttSupported || sending || isTranscribing ? 0.5 : 1,
                    flexShrink: 0,
                    padding: 0,
                  }}
                >
                  {isTranscribing ? (
                    "…"
                  ) : isRecording ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                      <rect x="6" y="6" width="12" height="12" rx="1.5" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ display: "block" }}>
                      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                      <line x1="12" y1="19" x2="12" y2="23" />
                    </svg>
                  )}
                </button>
                <button
                  onClick={() => handleSend()}
                  disabled={sending || isTranscribing || !input.trim()}
                  style={{
                    alignSelf: "flex-end",
                    background: C.text, color: C.bg,
                    border: "none", borderRadius: "8px",
                    width: "40px", height: "40px",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: sending || isTranscribing || !input.trim() ? "not-allowed" : "pointer",
                    opacity: sending || isTranscribing || !input.trim() ? 0.5 : 1,
                    fontSize: "18px", flexShrink: 0,
                    transition: "opacity 0.13s, transform 0.1s",
                  }}
                >
                  ↑
                </button>
              </div>

              {/* Pinned Repos indicator at bottom */}
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: C.textSub, fontWeight: 600 }}>
                  <span>Repos pinned</span>
                  <span>{pins.length} / 3</span>
                </div>
                <div style={{ height: "4px", background: "rgba(255, 255, 255, 0.06)", borderRadius: "2px", overflow: "hidden" }}>
                  <div style={{ height: "100%", background: C.green, width: `${Math.min((pins.length / 3) * 100, 100)}%`, transition: "width 0.3s ease" }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Report Modal overlay */}
      {reportModalOpen && reportMd && (
        <div
          onClick={() => setReportModalOpen(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000,
            display: "flex", alignItems: "center", justifyContent: "center", padding: "20px"
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: "12px",
              width: "min(800px, 100%)", maxHeight: "80vh", display: "flex", flexDirection: "column",
              boxShadow: "0 10px 40px rgba(0,0,0,0.6)", overflow: "hidden"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: `1px solid ${C.border}`, background: C.bgHover }}>
              <span style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: "15px", color: C.text }}>📄 Research Report: {title}</span>
              <button
                onClick={() => setReportModalOpen(false)}
                style={{
                  width: "28px", height: "28px", borderRadius: "6px", border: `1px solid ${C.border}`,
                  background: "transparent", color: C.textSub, display: "flex", alignItems: "center",
                  justifyContent: "center", cursor: "pointer", transition: "all 0.15s"
                }}
              >
                ✕
              </button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "24px 30px" }} className="research-md">
              <MD>{reportMd}</MD>
            </div>
            <div style={{ padding: "12px 20px", borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "flex-end", background: C.bgHover }}>
              <button
                onClick={handleExportMd}
                style={{
                  fontFamily: "var(--font-sans)", fontSize: "12px", fontWeight: 600,
                  padding: "6px 16px", borderRadius: "6px", border: `1px solid ${C.border}`,
                  background: C.text, color: C.bg, cursor: "pointer"
                }}
              >
                ↓ Export Markdown
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
