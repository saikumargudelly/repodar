"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import { api } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";

interface EcosystemOverviewProps {
  repoId: string;
  repo: any;
}

export function EcosystemOverview({ repoId, repo }: EcosystemOverviewProps) {
  const { showToast } = useToast();
  const [reportMd, setReportMd] = useState<string | null>(null);
  const [generatingReport, setGeneratingReport] = useState(false);

  // Search & Filter state for alternatives
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"confidence" | "stars">("confidence");
  const [selectedLanguage, setSelectedLanguage] = useState("all");
  const [showAllAlternatives, setShowAllAlternatives] = useState(false);

  const { data: ecosystem, isLoading, error } = useQuery({
    queryKey: ["ecosystem-map", repoId],
    queryFn: () => api.getEcosystemMap(repoId),
    enabled: !!repoId,
  });

  const handleGenerateReport = async () => {
    setGeneratingReport(true);
    try {
      const res = await api.generateEcosystemReport(repoId);
      setReportMd(res.content_md);
    } catch (err) {
      console.error(err);
      showToast("Failed to generate ecosystem report.", "error");
    } finally {
      setGeneratingReport(false);
    }
  };

  if (isLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "40vh" }}>
        <p style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)", fontSize: "12px" }}>
          // ANALYSING ECOSYSTEM DATA<span className="terminal-cursor" />
        </p>
      </div>
    );
  }

  if (error || !ecosystem) {
    return (
      <div className="panel card-pad" style={{ borderLeft: "3px solid var(--accent-red)", background: "rgba(38, 37, 36, 0.2)", borderRadius: "8px" }}>
        <p style={{ fontFamily: "var(--font-mono)", color: "var(--accent-red)", margin: 0 }}>
          ✕ Error loading ecosystem data. Please ensure repository is indexed.
        </p>
      </div>
    );
  }

  const primaryCategory = ecosystem.primary_category || "OSS Tools";
  const strength = ecosystem.strength;
  const relationships = ecosystem.relationships || [];

  const alternatives = relationships.filter((r: any) => r.relationship === "alternative");
  const companions = relationships.filter((r: any) => r.relationship === "companion");

  // Filter & Sort Alternatives
  const filteredAlternatives = alternatives
    .filter((alt: any) => {
      const matchesSearch = alt.related_repo.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesLang = selectedLanguage === "all" || (alt.primary_language && alt.primary_language.toLowerCase() === selectedLanguage.toLowerCase());
      return matchesSearch && matchesLang;
    })
    .sort((a: any, b: any) => {
      if (sortBy === "stars") {
        return (b.stars || 0) - (a.stars || 0);
      }
      return (b.confidence || 0) - (a.confidence || 0);
    });

  // Highlight direct alternatives: Most Similar & Most Popular
  let maxConfidence = -1;
  let maxStars = -1;
  let mostSimilarRepo = "";
  let mostPopularRepo = "";

  alternatives.forEach((alt: any) => {
    if (alt.confidence > maxConfidence) {
      maxConfidence = alt.confidence;
      mostSimilarRepo = alt.related_repo;
    }
    if (alt.stars > maxStars) {
      maxStars = alt.stars;
      mostPopularRepo = alt.related_repo;
    }
  });

  const displayedAlternatives = showAllAlternatives
    ? filteredAlternatives
    : filteredAlternatives.slice(0, 5);

  const getEcosystemMaturityText = (score: number) => {
    if (score >= 75) return "Mature Ecosystem";
    if (score >= 45) return "Growing Ecosystem";
    return "Emerging Ecosystem";
  };

  const getEcosystemMaturityColor = (score: number) => {
    if (score >= 75) return "var(--accent-green)";
    if (score >= 45) return "var(--accent-yellow)";
    return "var(--text-muted)";
  };

  // Extract unique languages for filter dropdown
  const uniqueLanguages = Array.from(
    new Set(
      alternatives
        .map((alt: any) => alt.primary_language)
        .filter(Boolean)
    )
  ) as string[];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      
      {/* Question 1: Where does this repository fit? */}
      <div 
        className="panel card-pad"
        style={{
          background: "rgba(38, 37, 36, 0.2)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          border: "1px solid var(--border)",
          borderRadius: "8px",
          padding: "20px"
        }}
      >
        <h3 style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "6px" }}>
          🌐 Where does this repository fit?
        </h3>
        <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: "0 0 16px 0" }}>
          Repository category landscape and ecosystem maturity dashboard.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "20px" }}>
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <span style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.05em" }}>Category classification</span>
            <span style={{ fontSize: "20px", fontWeight: "bold", color: "var(--text-primary)", marginTop: "4px" }}>{primaryCategory}</span>
            <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "8px", lineHeight: "1.4" }}>
              {strength.details}
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "16px", borderLeft: "1px solid var(--border)", paddingLeft: "20px" }}>
            <div style={{ position: "relative", width: "64px", height: "64px", flexShrink: 0 }}>
              <svg width="64" height="64" viewBox="0 0 36 36">
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="var(--border)"
                  strokeWidth="2.5"
                />
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="var(--accent-blue)"
                  strokeWidth="2.5"
                  strokeDasharray={`${strength.score}, 100`}
                  strokeLinecap="round"
                />
              </svg>
              <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", fontSize: "14px", fontWeight: "bold", fontFamily: "var(--font-mono)", color: "var(--text-primary)" }}>
                {strength.score}
              </div>
            </div>
            <div>
              <span style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.05em" }}>Category strength</span>
              <div style={{ fontSize: "14px", fontWeight: "bold", color: getEcosystemMaturityColor(strength.score), marginTop: "2px" }}>
                {getEcosystemMaturityText(strength.score)}
              </div>
              <span style={{ display: "block", fontSize: "9px", color: "var(--text-muted)", marginTop: "2px" }}>
                Calculated from category health metrics
              </span>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", borderLeft: "1px solid var(--border)", paddingLeft: "20px", fontSize: "12px" }}>
            <div style={{ marginBottom: "6px" }}>
              <span style={{ color: "var(--text-muted)" }}>Active Projects: </span>
              <strong style={{ color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>{strength.metrics?.active_projects ?? 0}</strong>
            </div>
            <div style={{ marginBottom: "6px" }}>
              <span style={{ color: "var(--text-muted)" }}>Total Category Stars: </span>
              <strong style={{ color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>{(strength.metrics?.total_stars ?? 0).toLocaleString()}</strong>
            </div>
            <div>
              <span style={{ color: "var(--text-muted)" }}>Avg Star Velocity: </span>
              <strong style={{ color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>{strength.metrics?.average_velocity ?? 0}/day</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Question 2: What repositories solve similar problems? */}
      <div 
        className="panel card-pad"
        style={{
          background: "rgba(38, 37, 36, 0.2)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          border: "1px solid var(--border)",
          borderRadius: "8px",
          padding: "20px"
        }}
      >
        <h3 style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "6px" }}>
          ⚔️ What repositories solve similar problems?
        </h3>
        <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: "0 0 16px 0" }}>
          Direct alternatives and emerging competitors. Showing direct telemetry similarity explanations.
        </p>

        {/* Filter controls */}
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "16px" }}>
          <input
            type="text"
            placeholder="Search alternatives..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              flex: 1,
              minWidth: "200px",
              padding: "6px 12px",
              borderRadius: "4px",
              border: "1px solid var(--border)",
              background: "rgba(255,255,255,0.02)",
              color: "var(--text-primary)",
              fontSize: "12px"
            }}
          />
          
          <select
            value={sortBy}
            onChange={(e: any) => setSortBy(e.target.value)}
            style={{
              padding: "6px 12px",
              borderRadius: "4px",
              border: "1px solid var(--border)",
              background: "rgba(38, 37, 36, 0.9)",
              color: "var(--text-primary)",
              fontSize: "12px"
            }}
          >
            <option value="confidence">Sort by Similarity</option>
            <option value="stars">Sort by Stars</option>
          </select>

          <select
            value={selectedLanguage}
            onChange={(e) => setSelectedLanguage(e.target.value)}
            style={{
              padding: "6px 12px",
              borderRadius: "4px",
              border: "1px solid var(--border)",
              background: "rgba(38, 37, 36, 0.9)",
              color: "var(--text-primary)",
              fontSize: "12px"
            }}
          >
            <option value="all">All Languages</option>
            {uniqueLanguages.map((lang) => (
              <option key={lang} value={lang}>{lang}</option>
            ))}
          </select>
        </div>

        {filteredAlternatives.length === 0 ? (
          <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: 0 }}>
            No matching alternatives found.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div className="table-scroll">
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    <th style={{ textAlign: "left", padding: "10px 16px", color: "var(--text-muted)", fontSize: "11px", fontWeight: 600 }}>ALTERNATIVE</th>
                    <th style={{ textAlign: "left", padding: "10px 16px", color: "var(--text-muted)", fontSize: "11px", fontWeight: 600 }}>STARS</th>
                    <th style={{ textAlign: "left", padding: "10px 16px", color: "var(--text-muted)", fontSize: "11px", fontWeight: 600 }}>LANGUAGE</th>
                    <th style={{ textAlign: "left", padding: "10px 16px", color: "var(--text-muted)", fontSize: "11px", fontWeight: 600 }}>SIMILARITY</th>
                    <th style={{ textAlign: "left", padding: "10px 16px", color: "var(--text-muted)", fontSize: "11px", fontWeight: 600 }}>RELATIONSHIP EVIDENCE</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedAlternatives.map((alt: any) => {
                    const isMostSimilar = alt.related_repo === mostSimilarRepo;
                    const isMostPopular = alt.related_repo === mostPopularRepo;
                    
                    return (
                      <tr key={alt.related_repo} className="tr-cyber" style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={{ padding: "12px 16px", fontWeight: 600 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                            <a href={`https://github.com/${alt.related_repo}`} target="_blank" rel="noopener noreferrer" style={{ color: "#58a6ff", textDecoration: "none" }}>
                              {alt.related_repo}
                            </a>
                            {isMostSimilar && (
                              <span style={{ fontSize: "9px", background: "rgba(88, 166, 255, 0.1)", color: "var(--accent-blue)", padding: "1px 5px", borderRadius: "3px", border: "1px solid rgba(88, 166, 255, 0.2)" }}>
                                Most Similar
                              </span>
                            )}
                            {isMostPopular && (
                              <span style={{ fontSize: "9px", background: "rgba(210, 153, 34, 0.1)", color: "var(--accent-yellow)", padding: "1px 5px", borderRadius: "3px", border: "1px solid rgba(210, 153, 34, 0.2)" }}>
                                Most Popular
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: "12px 16px", fontFamily: "var(--font-mono)" }}>
                          {alt.stars ? alt.stars.toLocaleString() : "—"}
                        </td>
                        <td style={{ padding: "12px 16px", color: "var(--text-secondary)" }}>
                          {alt.primary_language || "—"}
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                            <span style={{
                              fontWeight: "bold",
                              fontFamily: "var(--font-mono)",
                              color: alt.confidence >= 0.75 ? "var(--accent-green)" : alt.confidence >= 0.50 ? "var(--accent-yellow)" : "var(--accent-red)",
                            }}>
                              {Math.round(alt.confidence * 100)}% Match
                            </span>
                            <span style={{ fontSize: "9px", color: "var(--text-muted)" }}>
                              Jaccard Similarity index
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: "12px 16px", color: "var(--text-secondary)", lineHeight: "1.4" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                            <span>{alt.explanation}</span>
                            <span style={{ fontSize: "9px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                              Evidence: {alt.source === "topic_similarity" ? "✓ Shared Topics" : "✓ Shared Category Class"}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {filteredAlternatives.length > 5 && (
              <button
                onClick={() => setShowAllAlternatives(!showAllAlternatives)}
                style={{
                  alignSelf: "center",
                  background: "none",
                  border: "1px solid var(--border)",
                  color: "var(--text-secondary)",
                  padding: "6px 16px",
                  borderRadius: "6px",
                  fontSize: "12px",
                  cursor: "pointer",
                  marginTop: "8px",
                  fontWeight: 600,
                  transition: "background 0.15s ease"
                }}
                className="hover:bg-zinc-800"
              >
                {showAllAlternatives ? "Show Less Competitors" : `Show More Competitors (${filteredAlternatives.length - 5} remaining)`}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Question 3: Which repositories are commonly used together? */}
      <div 
        className="panel card-pad"
        style={{
          background: "rgba(38, 37, 36, 0.2)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          border: "1px solid var(--border)",
          borderRadius: "8px",
          padding: "20px"
        }}
      >
        <h3 style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "6px" }}>
          🔌 Which repositories are commonly used alongside it?
        </h3>
        <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: "0 0 16px 0" }}>
          Frequently combined tech stacks and adjacent companions observed in production environments.
        </p>

        {companions.length === 0 ? (
          <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: 0 }}>
            No adjacent integrations detected for this category.
          </p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "12px" }}>
            {companions.slice(0, 6).map((comp: any) => (
              <div 
                key={comp.related_repo}
                style={{
                  background: "rgba(255, 255, 255, 0.01)",
                  border: "1px solid var(--border)",
                  borderRadius: "6px",
                  padding: "12px 14px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between"
                }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                    <a 
                      href={`https://github.com/${comp.related_repo}`} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      style={{ color: "#58a6ff", textDecoration: "none", fontWeight: 600, fontSize: "13px" }}
                    >
                      {comp.related_repo}
                    </a>
                    <span style={{ fontSize: "10px", background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)", color: "var(--text-muted)", padding: "1px 6px", borderRadius: "4px" }}>
                      Companion
                    </span>
                  </div>
                  <p style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: "1.4", margin: "0 0 8px 0" }}>
                    {comp.explanation}
                  </p>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid rgba(255,255,255,0.03)", paddingTop: "8px", marginTop: "4px", fontSize: "10px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                  <span>{comp.primary_language || "Language N/A"}</span>
                  <span>⭐ {comp.stars ? comp.stars.toLocaleString() : "—"}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Analyst Landscape Brief */}
      <div 
        className="panel card-pad" 
        style={{ 
          display: "flex", 
          flexDirection: "column", 
          justifyContent: "space-between",
          background: "rgba(38, 37, 36, 0.2)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          border: "1px solid var(--border)",
          borderRadius: "8px",
          padding: "20px"
        }}
      >
        <div>
          <h3 style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "6px" }}>
            📋 Category Landscape Research Brief
          </h3>
          <p style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: "1.5", margin: "0 0 16px 0" }}>
            Generate a structured landscape brief explaining relationship matrices and competitor strengths for the `{primaryCategory}` category.
          </p>
        </div>
        <button
          onClick={handleGenerateReport}
          disabled={generatingReport}
          style={{
            width: "100%",
            padding: "10px 16px",
            borderRadius: "6px",
            background: "var(--text-primary)",
            color: "#000",
            fontWeight: 700,
            border: "none",
            cursor: "pointer",
            fontSize: "12.5px",
            transition: "opacity 0.2s"
          }}
          className="hover:opacity-90"
        >
          {generatingReport ? "Generating Brief..." : "⚡ Generate Ecosystem Brief"}
        </button>
      </div>

      {/* Render Markdown Ecosystem Report inline */}
      {reportMd && (
        <div 
          className="panel card-pad" 
          style={{ 
            borderLeft: "3px solid var(--accent-blue)", 
            background: "rgba(38, 37, 36, 0.2)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            border: "1px solid var(--border)",
            borderLeftWidth: "3px",
            borderLeftColor: "var(--accent-blue)",
            borderRadius: "8px",
            padding: "20px 24px",
            boxShadow: "0 4px 20px rgba(0, 0, 0, 0.15)"
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)" }}>📄 Category Landscape Report</span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(reportMd);
                showToast("Report copied to clipboard!", "success");
              }}
              style={{
                background: "none",
                border: "1px solid var(--border)",
                color: "var(--text-secondary)",
                padding: "4px 10px",
                borderRadius: "4px",
                fontSize: "11px",
                cursor: "pointer"
              }}
            >
              Copy Markdown
            </button>
          </div>
          <div style={{ color: "var(--text-secondary)", fontSize: "13px", lineHeight: "1.7", overflowY: "auto", maxHeight: "500px", paddingRight: "10px" }} className="markdown-body font-sans">
            <ReactMarkdown>{reportMd}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}
