import React from "react";

interface NinjaRankPillProps {
  label: string | null | undefined;
}

export function NinjaRankPill({ label }: NinjaRankPillProps) {
  const norm = (label || "").toUpperCase().trim();

  let rankClass = "rank-genin";
  let kanjiText = "下忍";
  let englishText = "Genin";

  if (norm === "GREEN" || norm === "HEALTHY") {
    rankClass = "rank-jonin";
    kanjiText = "上忍";
    englishText = "Jonin";
  } else if (norm === "YELLOW" || norm === "CAUTION") {
    rankClass = "rank-chunin";
    kanjiText = "中忍";
    englishText = "Chunin";
  } else if (norm === "ANBU") {
    rankClass = "rank-anbu";
    kanjiText = "暗部";
    englishText = "ANBU";
  } else if (norm === "RED" || norm === "CRITICAL" || norm === "LOW") {
    rankClass = "rank-genin";
    kanjiText = "下忍";
    englishText = "Genin";
  }

  return (
    <span className={`ninja-rank-pill ${rankClass}`}>
      <span style={{ marginRight: "3px" }}>{kanjiText}</span>
      <span>{englishText}</span>
    </span>
  );
}
