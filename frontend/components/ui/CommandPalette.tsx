"use client";

import { useEffect, useState, useMemo } from "react";
import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface CommandPaletteProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

export function CommandPalette({ isOpen, setIsOpen }: CommandPaletteProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [selectedReposForCompare, setSelectedReposForCompare] = useState<any[]>([]);

  // Toggle open/close on cmd+K or ctrl+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsOpen(!isOpen);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [isOpen, setIsOpen]);

  // Fetch repositories list for quick search
  const { data: reposData } = useQuery({
    queryKey: ["command-palette-repos"],
    queryFn: () => api.getRadar(false, "All", undefined, "trend_score", "desc", 100),
    enabled: isOpen,
  });

  const repos = reposData ?? [];

  // Filter repos based on search
  const filteredRepos = useMemo(() => {
    if (!search) return repos.slice(0, 10);
    const q = search.toLowerCase();
    return repos
      .filter((r) => r.name.toLowerCase().includes(q) || r.owner.toLowerCase().includes(q))
      .slice(0, 10);
  }, [repos, search]);

  const toggleCompareRepo = (repo: any) => {
    setSelectedReposForCompare((prev) => {
      const exists = prev.some((r) => r.repo_id === repo.repo_id);
      if (exists) {
        return prev.filter((r) => r.repo_id !== repo.repo_id);
      } else {
        if (prev.length >= 5) return prev;
        return [...prev, repo];
      }
    });
  };

  const handleCompareTrigger = () => {
    if (selectedReposForCompare.length < 2) return;
    const ids = selectedReposForCompare.map((r) => r.repo_id);
    router.push(`/compare?repos=${ids.join(",")}`);
    setIsOpen(false);
    setSelectedReposForCompare([]);
  };

  if (!isOpen) return null;

  return (
    <div
      onClick={() => setIsOpen(false)}
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(4px)",
        zIndex: 9999,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "15vh",
        animation: "fade-in 0.15s ease",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "550px",
          maxWidth: "90%",
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "8px",
          boxShadow: "0 10px 30px rgba(0, 0, 0, 0.5)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Command label="Global Command Menu" value={search} onValueChange={setSearch}>
          <div style={{ display: "flex", alignItems: "center", borderBottom: "1px solid var(--border)", padding: "12px 16px" }}>
            <span style={{ color: "var(--text-muted)", marginRight: "10px", fontSize: "14px" }}>🔍</span>
            <Command.Input
              autoFocus
              placeholder="Search repositories, pages, or comparison..."
              style={{
                flex: 1,
                border: "none",
                background: "transparent",
                color: "var(--text-primary)",
                fontSize: "14px",
                outline: "none",
                fontFamily: "var(--font-sans)",
              }}
            />
          </div>

          <Command.List style={{ maxHeight: "300px", overflowY: "auto", padding: "8px" }}>
            <Command.Empty style={{ padding: "12px 16px", fontSize: "13px", color: "var(--text-muted)" }}>
              No results found.
            </Command.Empty>

            {/* Comparison Selection Indicator */}
            {selectedReposForCompare.length > 0 && (
              <Command.Group heading="Repository Comparison" style={{ color: "var(--text-muted)", fontSize: "11px", fontWeight: 600, padding: "8px 12px 4px" }}>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", margin: "4px 0 8px 0" }}>
                  {selectedReposForCompare.map((r) => (
                    <span
                      key={r.repo_id}
                      onClick={() => toggleCompareRepo(r)}
                      style={{
                        background: "rgba(88, 166, 255, 0.12)",
                        color: "var(--accent-blue)",
                        border: "1px solid rgba(88, 166, 255, 0.25)",
                        padding: "2px 8px",
                        borderRadius: "12px",
                        fontSize: "11px",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px"
                      }}
                    >
                      {r.owner}/{r.name} ✕
                    </span>
                  ))}
                </div>
                {selectedReposForCompare.length >= 2 && (
                  <Command.Item
                    onSelect={handleCompareTrigger}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 12px",
                      borderRadius: "6px",
                      cursor: "pointer",
                      background: "rgba(63, 185, 80, 0.12)",
                      color: "var(--accent-green)",
                      border: "1px solid rgba(63, 185, 80, 0.2)",
                      fontWeight: 600,
                      fontSize: "12px"
                    }}
                  >
                    Compare selected repositories ({selectedReposForCompare.length}) →
                  </Command.Item>
                )}
              </Command.Group>
            )}

            {/* Navigation Actions */}
            <Command.Group heading="Navigation" style={{ color: "var(--text-muted)", fontSize: "11px", fontWeight: 600, padding: "8px 12px 4px" }}>
              {[
                { href: "/overview", label: "Go to Overview" },
                { href: "/radar", label: "Go to Radar Feed" },
                { href: "/watchlist", label: "Go to Watchlist" },
                { href: "/research", label: "Go to Research Labs" },
                { href: "/profile", label: "Go to Profile Settings" },
              ].map((link) => (
                <Command.Item
                  key={link.href}
                  onSelect={() => {
                    router.push(link.href);
                    setIsOpen(false);
                  }}
                  className="cmd-item"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    fontSize: "13px",
                    color: "var(--text-secondary)",
                    cursor: "pointer",
                    transition: "all 0.1s"
                  }}
                >
                  🔗 <span style={{ marginLeft: "8px" }}>{link.label}</span>
                </Command.Item>
              ))}
            </Command.Group>

            {/* Repositories Quick Search */}
            <Command.Group heading="Repositories" style={{ color: "var(--text-muted)", fontSize: "11px", fontWeight: 600, padding: "12px 12px 4px" }}>
              {filteredRepos.map((repo) => {
                const isSelected = selectedReposForCompare.some((r) => r.repo_id === repo.repo_id);
                return (
                  <Command.Item
                    key={repo.repo_id}
                    onSelect={() => {
                      router.push(`/repo/${repo.owner}/${repo.name}`);
                      setIsOpen(false);
                    }}
                    className="cmd-item"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 12px",
                      borderRadius: "6px",
                      fontSize: "13px",
                      color: "var(--text-secondary)",
                      cursor: "pointer",
                      transition: "all 0.1s"
                    }}
                  >
                    <div>
                      📦 <span style={{ marginLeft: "8px", fontWeight: 600, color: "var(--text-primary)" }}>{repo.owner}/{repo.name}</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleCompareRepo(repo);
                      }}
                      style={{
                        background: isSelected ? "var(--accent-blue)" : "transparent",
                        color: isSelected ? "#fff" : "var(--text-muted)",
                        border: "1px solid var(--border)",
                        borderRadius: "4px",
                        padding: "2px 8px",
                        fontSize: "11px",
                        cursor: "pointer"
                      }}
                    >
                      {isSelected ? "Selected" : "Select to compare"}
                    </button>
                  </Command.Item>
                );
              })}
            </Command.Group>
          </Command.List>

          {/* Footer help */}
          <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid var(--border)", padding: "10px 16px", fontSize: "11px", color: "var(--text-muted)" }}>
            <span>Use ↑↓ to navigate, Enter to select</span>
            <span>ESC to close</span>
          </div>
        </Command>
      </div>
    </div>
  );
}
