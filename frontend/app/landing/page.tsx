"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

type FeatureTab = "radar" | "lb" | "alerts" | "insights";

const TICKER_ITEMS = [
  "HuggingFace", "LangChain", "Ollama", "Vercel AI", "OpenAI",
  "Anthropic", "Mistral AI", "LlamaIndex", "CrewAI", "AutoGen",
  "DSPy", "Axolotl", "Unsloth", "SGLang", "vLLM", "TGI", "mem0ai",
];

const LANDING_CSS = `
.ld-page {
  --bg:        #080d18;
  --bg-2:      #0c1220;
  --bg-3:      #111827;
  --surface:   #131d2e;
  --surface-2: #1a2540;
  --surface-3: #1f2d4a;
  --border:    rgba(255,255,255,0.07);
  --border-2:  rgba(255,255,255,0.12);
  --ink:       #eef2fb;
  --ink-2:     #a8b4cc;
  --ink-3:     #5f7191;
  --ink-4:     #374561;
  --blue:      #4f8ef7;
  --blue-dim:  rgba(79,142,247,0.12);
  --blue-glow: rgba(79,142,247,0.25);
  --teal:      #2dd4bf;
  --teal-dim:  rgba(45,212,191,0.12);
  --amber:     #fbbf24;
  --amber-dim: rgba(251,191,36,0.12);
  --red:       #f87171;
  --red-dim:   rgba(248,113,113,0.12);
  --serif:     'Instrument Serif', Georgia, serif;
  --sans:      'DM Sans', sans-serif;
  --mono:      'DM Mono', monospace;
  --r:         10px;
  --r-lg:      16px;
  font-family: var(--sans);
  background: var(--bg);
  color: var(--ink);
  overflow-x: hidden;
  -webkit-font-smoothing: antialiased;
  line-height: 1.6;
  min-height: 100vh;
  position: relative;
}
.ld-page *, .ld-page *::before, .ld-page *::after { box-sizing: border-box; }
.ld-page a { color: inherit; }

/* noise overlay */
.ld-page::before {
  content: '';
  position: fixed; inset: 0; z-index: 0; pointer-events: none;
  opacity: 0.025;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E");
  background-size: 200px 200px;
}

/* hero glow */
.ld-hero-glow {
  position: absolute; top: -160px; left: 50%; transform: translateX(-50%);
  width: 900px; height: 600px; pointer-events: none; z-index: 0;
  background: radial-gradient(ellipse at 50% 0%, rgba(79,142,247,0.13) 0%, transparent 65%);
}

/* NAV */
.ld-nav {
  position: fixed; top: 0; left: 0; right: 0; z-index: 100;
  height: 58px;
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 2rem;
  background: rgba(8,13,24,0.8);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid var(--border);
}
.ld-logo {
  display: flex; align-items: center; gap: 9px;
  text-decoration: none; color: var(--ink); font-weight: 600;
  font-size: 0.95rem; letter-spacing: -0.02em;
}
.ld-logo-mark {
  width: 26px; height: 26px; border-radius: 7px;
  background: linear-gradient(135deg, #1e3a6e, #2c4f96);
  display: flex; align-items: center; justify-content: center;
  position: relative; flex-shrink: 0;
  border: 1px solid rgba(79,142,247,0.3);
  overflow: hidden;
}
.ld-logo-mark::after {
  content: '';
  position: absolute;
  width: 13px; height: 13px;
  border: 1.5px solid rgba(79,142,247,0.6);
  border-radius: 50%;
}
.ld-logo-mark::before {
  content: '';
  position: absolute;
  width: 4px; height: 4px;
  border-radius: 50%;
  background: #4f8ef7;
  box-shadow: 0 0 6px rgba(79,142,247,0.8);
  z-index: 1;
}
.ld-nav-links { display: flex; gap: 0.25rem; }
.ld-nav-link {
  padding: 0.45rem 0.85rem; border-radius: var(--r);
  font-size: 0.85rem; color: var(--ink-2); text-decoration: none;
  transition: color 0.15s, background 0.15s;
}
.ld-nav-link:hover { color: var(--ink); background: rgba(255,255,255,0.05); }
.ld-nav-right { display: flex; align-items: center; gap: 0.5rem; }
.ld-btn-nav-ghost {
  padding: 0.4rem 0.9rem; border-radius: var(--r);
  font-size: 0.85rem; color: var(--ink-2); font-weight: 500;
  text-decoration: none; transition: color 0.15s, background 0.15s;
  border: 1px solid transparent;
}
.ld-btn-nav-ghost:hover { color: var(--ink); background: rgba(255,255,255,0.05); border-color: var(--border-2); }
.ld-btn-nav-solid {
  padding: 0.4rem 1rem; border-radius: var(--r);
  font-size: 0.85rem; font-weight: 500; color: #fff;
  text-decoration: none; background: var(--blue);
  transition: background 0.15s, transform 0.15s;
  display: flex; align-items: center; gap: 5px;
}
.ld-btn-nav-solid:hover { background: #6ba3f8; transform: translateY(-1px); }

/* HERO */
.ld-hero-wrap { position: relative; overflow: hidden; padding-top: 58px; }
.ld-hero {
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 4rem; align-items: center;
  max-width: 1160px; margin: 0 auto;
  padding: 100px 2rem 80px;
  position: relative; z-index: 1;
}
.ld-badge {
  display: inline-flex; align-items: center; gap: 8px;
  font-size: 0.72rem; font-weight: 500; letter-spacing: 0.04em;
  padding: 0.35rem 0.8rem; border-radius: 100px;
  background: var(--blue-dim); border: 1px solid rgba(79,142,247,0.25);
  color: var(--blue); margin-bottom: 1.6rem;
}
.ld-badge-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--blue); flex-shrink: 0;
  animation: ld-blink 1.4s ease-in-out infinite;
}
@keyframes ld-blink { 0%,100%{opacity:1} 50%{opacity:0.3} }
.ld-h1 {
  font-family: var(--serif);
  font-size: clamp(2.6rem, 4.2vw, 3.8rem);
  font-weight: 400;
  letter-spacing: -0.025em;
  line-height: 1.12;
  color: var(--ink);
  margin: 0 0 1.25rem;
}
.ld-h1 em { font-style: italic; color: var(--blue); }
.ld-hero-desc {
  font-size: 0.98rem; color: var(--ink-2); max-width: 440px;
  line-height: 1.78; font-weight: 300; margin: 0 0 2rem;
}
.ld-hero-cta { display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap; margin-bottom: 2.5rem; }
.ld-btn-primary {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 0.75rem 1.5rem; border-radius: var(--r);
  font-size: 0.9rem; font-weight: 600; color: var(--bg);
  background: var(--blue); text-decoration: none;
  transition: background 0.15s, transform 0.15s, box-shadow 0.15s;
  box-shadow: 0 2px 12px var(--blue-glow);
}
.ld-btn-primary:hover { background: #6ba3f8; transform: translateY(-2px); box-shadow: 0 6px 24px var(--blue-glow); }
.ld-btn-secondary {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 0.75rem 1.25rem; border-radius: var(--r);
  font-size: 0.9rem; font-weight: 500; color: var(--ink-2);
  text-decoration: none; border: 1px solid var(--border-2);
  background: transparent; transition: color 0.15s, border-color 0.15s, background 0.15s;
}
.ld-btn-secondary:hover { color: var(--ink); border-color: rgba(255,255,255,0.2); background: rgba(255,255,255,0.04); }
.ld-hero-meta { display: flex; gap: 1.5rem; align-items: center; flex-wrap: wrap; }
.ld-meta-num { font-family: var(--serif); font-size: 1.25rem; font-weight: 400; color: var(--ink); letter-spacing: -0.03em; line-height: 1.2; }
.ld-meta-label { font-size: 0.72rem; color: var(--ink-3); margin-top: 1px; }
.ld-meta-sep { width: 1px; height: 28px; background: var(--border-2); align-self: center; }

/* HERO CARD */
.ld-hero-card-wrap { position: relative; padding: 40px 20px 50px; }
.ld-hero-card {
  background: var(--surface);
  border: 1px solid var(--border-2);
  border-radius: var(--r-lg); overflow: hidden;
  box-shadow: 0 30px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(79,142,247,0.05);
  transform: perspective(900px) rotateY(-5deg) rotateX(2deg);
  transition: transform 0.4s ease;
}
.ld-hero-card:hover { transform: perspective(900px) rotateY(-2deg) rotateX(1deg); }
.ld-hc-topbar {
  padding: 0.7rem 1rem; background: var(--bg-3);
  border-bottom: 1px solid var(--border);
  display: flex; align-items: center; gap: 0.75rem;
}
.ld-hc-dots { display: flex; gap: 6px; }
.ld-hc-dots span { width: 10px; height: 10px; border-radius: 50%; }
.ld-hc-dots span:nth-child(1) { background: #ff5f57; }
.ld-hc-dots span:nth-child(2) { background: #febc2e; }
.ld-hc-dots span:nth-child(3) { background: #28c840; }
.ld-hc-url { flex: 1; text-align: center; font-family: var(--mono); font-size: 0.68rem; color: var(--ink-3); letter-spacing: 0.02em; }
.ld-hc-body { padding: 1.2rem; }
.ld-hc-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; }
.ld-hc-title { font-size: 0.8rem; font-weight: 600; color: var(--ink); }
.ld-live-pip { display: flex; align-items: center; gap: 5px; font-size: 0.62rem; font-weight: 600; color: var(--teal); letter-spacing: 0.06em; }
.ld-live-pip span { width: 6px; height: 6px; border-radius: 50%; background: var(--teal); animation: ld-blink 1.4s ease-in-out infinite; }
.ld-hc-stats { display: grid; grid-template-columns: repeat(3,1fr); gap: 0.5rem; margin-bottom: 1rem; }
.ld-hc-stat { background: var(--bg-3); border-radius: var(--r); padding: 0.6rem 0.7rem; }
.ld-hcs-num { font-family: var(--serif); font-size: 1.1rem; color: var(--ink); line-height: 1; letter-spacing: -0.02em; }
.ld-hcs-label { font-size: 0.62rem; color: var(--ink-3); margin-top: 2px; }
.ld-hcs-delta { font-size: 0.6rem; color: var(--teal); margin-top: 2px; }
.ld-hc-repo { display: flex; align-items: center; gap: 0.55rem; padding: 0.5rem 0; border-bottom: 1px solid var(--border); }
.ld-hc-repo:last-child { border-bottom: none; }
.ld-ri { width: 22px; height: 22px; border-radius: 5px; display: flex; align-items: center; justify-content: center; font-size: 0.65rem; flex-shrink: 0; }
.ld-rn { font-size: 0.75rem; font-family: var(--mono); color: var(--ink); flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ld-rs { font-size: 0.67rem; color: var(--ink-3); white-space: nowrap; }
.ld-rt { font-size: 0.65rem; font-weight: 600; min-width: 42px; text-align: right; }
.ld-rt-hot { color: var(--amber); }
.ld-rt-up  { color: var(--teal); }

/* floating chips */
.ld-fc {
  position: absolute;
  background: var(--surface-2); border: 1px solid var(--border-2);
  border-radius: var(--r-lg); padding: 0.75rem 1rem;
  box-shadow: 0 8px 32px rgba(0,0,0,0.4); min-width: 170px;
}
.ld-fc-1 { bottom: 10px; left: -10px; animation: ld-floatY 4s ease-in-out infinite; }
.ld-fc-2 { top: 60px; right: -10px; animation: ld-floatY 5s ease-in-out infinite 0.8s; }
.ld-fc-lbl { font-size: 0.62rem; color: var(--ink-3); margin-bottom: 0.2rem; text-transform: uppercase; letter-spacing: 0.06em; }
.ld-fc-val { font-size: 0.82rem; font-weight: 600; color: var(--ink); font-family: var(--mono); margin-bottom: 0.15rem; }
.ld-fc-sub { font-size: 0.67rem; color: var(--teal); }
@keyframes ld-floatY { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }

/* TICKER */
.ld-ticker {
  position: relative; overflow: hidden;
  background: var(--bg-2); border-top: 1px solid var(--border); border-bottom: 1px solid var(--border);
  padding: 0.8rem 0;
}
.ld-ticker::before, .ld-ticker::after {
  content:''; position:absolute; top:0; bottom:0; width:80px; z-index:2; pointer-events:none;
}
.ld-ticker::before { left:0; background:linear-gradient(90deg,var(--bg-2),transparent); }
.ld-ticker::after  { right:0; background:linear-gradient(-90deg,var(--bg-2),transparent); }
.ld-ticker-track {
  display:flex; gap:4rem; white-space:nowrap;
  animation:ld-tick 28s linear infinite; width:max-content;
  font-family:var(--mono); font-size:0.68rem; color:var(--ink-3); letter-spacing:0.04em;
}
.ld-ticker-track span { color:var(--teal); }
@keyframes ld-tick { to { transform:translateX(-50%); } }

/* SECTION */
.ld-section { padding:90px 2rem; max-width:1160px; margin:0 auto; position:relative; z-index:1; }
.ld-s-label {
  font-size:0.7rem; font-weight:500; letter-spacing:0.12em;
  text-transform:uppercase; color:var(--blue); margin-bottom:0.9rem;
  display:flex; align-items:center; gap:8px;
}
.ld-s-label::before { content:''; width:20px; height:1px; background:var(--blue); }
.ld-s-title {
  font-family:var(--serif); font-size:clamp(1.9rem,3.2vw,2.8rem);
  font-weight:400; letter-spacing:-0.025em; line-height:1.15;
  color:var(--ink); margin:0 0 0.9rem;
}
.ld-s-title em { font-style:italic; color:var(--blue); }
.ld-s-desc { font-size:0.95rem; color:var(--ink-2); max-width:480px; line-height:1.75; font-weight:300; margin:0; }

/* FEATURES */
.ld-features-bg { background:var(--bg-2); border-top:1px solid var(--border); border-bottom:1px solid var(--border); }
.ld-features-layout { display:grid; grid-template-columns:5fr 6fr; gap:4rem; align-items:start; margin-top:4rem; }
.ld-feat-tabs { display:flex; flex-direction:column; gap:2px; }
.ld-feat-tab { padding:1.2rem 1rem; border-radius:var(--r); cursor:pointer; border:1px solid transparent; transition:all 0.2s; }
.ld-feat-tab.active { background:var(--surface); border-color:var(--border-2); box-shadow:0 2px 12px rgba(0,0,0,0.25); }
.ld-feat-tab:not(.active):hover { background:var(--surface); }
.ld-ft-ico { font-size:1.1rem; margin-bottom:0.6rem; display:block; }
.ld-feat-tab h3 { font-size:0.9rem; font-weight:600; color:var(--ink); margin:0 0 0.25rem; }
.ld-feat-tab p { font-size:0.8rem; color:var(--ink-3); line-height:1.6; display:none; margin:0; }
.ld-feat-tab.active p { display:block; color:var(--ink-2); }
.ld-feat-panel {
  background:var(--surface); border:1px solid var(--border-2);
  border-radius:var(--r-lg); overflow:hidden;
  box-shadow:0 4px 24px rgba(0,0,0,0.3); position:sticky; top:80px;
}
.ld-fp-bar { padding:0.9rem 1.2rem; border-bottom:1px solid var(--border); display:flex; align-items:center; justify-content:space-between; background:var(--bg-3); }
.ld-fp-bar-title { font-size:0.75rem; font-weight:600; color:var(--ink); }
.ld-fp-chip { font-size:0.62rem; font-weight:500; padding:0.18rem 0.55rem; border-radius:100px; }
.ld-fp-body { padding:1.3rem; }
.ld-radar-wrap { display:flex; justify-content:center; padding:0.5rem 0; }
.ld-bars { display:flex; align-items:flex-end; gap:4px; height:75px; margin-bottom:0.9rem; }
.ld-bar { flex:1; border-radius:3px 3px 0 0; background:var(--surface-3); }
.ld-bar.hi { background:var(--blue); }
.ld-lb { display:flex; flex-direction:column; }
.ld-lb-row { display:flex; align-items:center; gap:0.65rem; padding:0.5rem 0; border-bottom:1px solid var(--border); }
.ld-lb-row:last-child { border-bottom:none; }
.ld-lb-n { font-size:0.65rem; color:var(--ink-4); width:16px; flex-shrink:0; }
.ld-lb-ico { width:24px; height:24px; border-radius:6px; display:flex; align-items:center; justify-content:center; font-size:0.65rem; flex-shrink:0; }
.ld-lb-name { font-size:0.77rem; font-weight:500; color:var(--ink); flex:1; }
.ld-lb-st { font-size:0.67rem; color:var(--ink-3); }
.ld-lb-ch { font-size:0.65rem; font-weight:600; color:var(--teal); min-width:38px; text-align:right; }
.ld-al { display:flex; flex-direction:column; }
.ld-al-row { display:flex; align-items:flex-start; gap:0.65rem; padding:0.6rem 0; border-bottom:1px solid var(--border); }
.ld-al-row:last-child { border-bottom:none; }
.ld-al-ico { width:24px; height:24px; border-radius:6px; display:flex; align-items:center; justify-content:center; font-size:0.65rem; flex-shrink:0; margin-top:1px; }
.ld-al-name { font-size:0.77rem; font-weight:500; color:var(--ink); }
.ld-al-desc { font-size:0.7rem; color:var(--ink-3); margin-top:1px; line-height:1.5; }
.ld-al-time { font-size:0.62rem; color:var(--ink-4); margin-left:auto; white-space:nowrap; padding-left:0.5rem; }

/* METRICS */
.ld-metrics-strip { border-top:1px solid var(--border); border-bottom:1px solid var(--border); background:var(--bg-3); }
.ld-metrics-grid { max-width:1160px; margin:0 auto; padding:0 2rem; display:grid; grid-template-columns:repeat(4,1fr); }
.ld-m-cell { padding:3rem 2rem; border-right:1px solid var(--border); }
.ld-m-cell:last-child { border-right:none; }
.ld-m-num { font-family:var(--serif); font-size:2.8rem; font-weight:400; color:var(--ink); letter-spacing:-0.04em; line-height:1; margin-bottom:0.4rem; }
.ld-m-num sup { font-size:1.2rem; color:var(--blue); vertical-align:super; }
.ld-m-label { font-size:0.78rem; color:var(--ink-3); }

/* HOW IT WORKS */
.ld-how-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:1.5rem; margin-top:4rem; }
.ld-how-card {
  background:var(--surface); border:1px solid var(--border);
  border-radius:var(--r-lg); padding:2rem; position:relative; overflow:hidden;
  transition:border-color 0.2s, box-shadow 0.2s;
}
.ld-how-card:hover { border-color:var(--border-2); box-shadow:0 8px 40px rgba(0,0,0,0.3); }
.ld-how-card::before {
  content:attr(data-n); position:absolute; right:1.5rem; top:1.5rem;
  font-family:var(--serif); font-size:4rem; color:var(--border);
  font-weight:400; line-height:1; pointer-events:none;
}
.ld-hw-ico { font-size:1.4rem; margin-bottom:1.2rem; display:block; }
.ld-how-card h3 { font-size:0.92rem; font-weight:600; color:var(--ink); margin:0 0 0.4rem; }
.ld-how-card p { font-size:0.82rem; color:var(--ink-2); line-height:1.7; margin:0; }
.ld-hw-tag { display:inline-block; margin-top:1.1rem; font-size:0.65rem; font-weight:500; letter-spacing:0.07em; text-transform:uppercase; padding:0.2rem 0.6rem; border-radius:100px; }

/* CAPABILITIES */
.ld-caps-bg { border-top:1px solid var(--border); background:var(--bg-2); }
.ld-caps-grid {
  display:grid; grid-template-columns:repeat(4,1fr);
  gap:1px; background:var(--border); border:1px solid var(--border);
  border-radius:var(--r-lg); overflow:hidden; margin-top:3.5rem;
}
.ld-cap-cell { background:var(--bg); padding:1.6rem; transition:background 0.2s; cursor:pointer; position:relative; }
.ld-cap-cell::after {
  content:''; position:absolute; top:0; left:0; right:0; height:2px;
  background:linear-gradient(90deg,var(--blue),var(--teal));
  transform:scaleX(0); transform-origin:left; transition:transform 0.3s ease;
}
.ld-cap-cell:hover { background:var(--surface); }
.ld-cap-cell:hover::after { transform:scaleX(1); }
.ld-cap-ico { font-size:1.2rem; margin-bottom:0.75rem; display:block; }
.ld-cap-name { font-size:0.85rem; font-weight:600; color:var(--ink); margin-bottom:0.25rem; }
.ld-cap-desc { font-size:0.73rem; color:var(--ink-3); line-height:1.55; }

/* PRICING */
.ld-pricing-bg { background:var(--bg-2); border-top:1px solid var(--border); }
.ld-pricing-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:1.2rem; margin-top:4rem; align-items:start; }
.ld-p-card { background:var(--surface); border:1px solid var(--border); border-radius:var(--r-lg); padding:1.8rem; transition:border-color 0.2s, box-shadow 0.2s; }
.ld-p-card:hover { border-color:var(--border-2); box-shadow:0 4px 24px rgba(0,0,0,0.25); }
.ld-p-card.featured { border-color:rgba(79,142,247,0.4); background:linear-gradient(160deg,var(--surface-2),var(--surface)); box-shadow:0 0 0 1px rgba(79,142,247,0.15),0 12px 40px rgba(79,142,247,0.1); }
.ld-p-plan { font-size:0.68rem; font-weight:600; letter-spacing:0.1em; text-transform:uppercase; color:var(--ink-3); margin-bottom:1rem; }
.ld-p-card.featured .ld-p-plan { color:var(--blue); }
.ld-p-price { font-family:var(--serif); font-size:2.8rem; font-weight:400; color:var(--ink); letter-spacing:-0.04em; line-height:1; margin-bottom:0.2rem; }
.ld-p-note { font-size:0.78rem; color:var(--ink-3); margin-bottom:1.2rem; }
.ld-p-divider { border:none; border-top:1px solid var(--border); margin:0 0 1.2rem; }
.ld-p-desc { font-size:0.82rem; color:var(--ink-2); margin-bottom:1.5rem; line-height:1.65; }
.ld-p-feats { list-style:none; padding:0; margin:0 0 1.8rem; display:flex; flex-direction:column; gap:0.55rem; }
.ld-p-feats li { font-size:0.82rem; color:var(--ink-2); display:flex; align-items:center; gap:0.55rem; }
.ld-p-feats li::before { content:'✓'; color:var(--teal); font-weight:600; font-size:0.7rem; flex-shrink:0; }
.ld-p-feats li.dim { color:var(--ink-4); }
.ld-p-feats li.dim::before { content:'–'; color:var(--ink-4); }
.ld-p-btn { display:block; width:100%; text-align:center; font-size:0.85rem; font-weight:500; border-radius:var(--r); padding:0.7rem; text-decoration:none; cursor:pointer; border:none; transition:all 0.15s; }
.ld-p-btn-ghost { background:var(--surface-3); color:var(--ink-2); border:1px solid var(--border-2); }
.ld-p-btn-ghost:hover { color:var(--ink); border-color:rgba(255,255,255,0.2); }
.ld-p-btn-blue { background:var(--blue); color:var(--bg); }
.ld-p-btn-blue:hover { background:#6ba3f8; transform:translateY(-1px); box-shadow:0 4px 16px rgba(79,142,247,0.3); }

/* CTA */
.ld-cta-band { position:relative; z-index:1; overflow:hidden; border-top:1px solid var(--border); padding:100px 2rem; text-align:center; }
.ld-cta-band::before {
  content:''; position:absolute; inset:0; pointer-events:none;
  background:
    radial-gradient(ellipse 800px 350px at 50% 100%,rgba(79,142,247,0.1) 0%,transparent 65%),
    radial-gradient(ellipse 500px 200px at 20% 50%,rgba(45,212,191,0.04) 0%,transparent 60%);
}
.ld-cta-btns { display:flex; gap:0.8rem; justify-content:center; flex-wrap:wrap; }

/* FOOTER */
.ld-footer { border-top:1px solid var(--border); padding:2.5rem 2rem; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:1.5rem; position:relative; z-index:1; }
.ld-footer-links { display:flex; gap:2rem; }
.ld-footer-links a { font-size:0.8rem; color:var(--ink-3); text-decoration:none; transition:color 0.15s; }
.ld-footer-links a:hover { color:var(--ink-2); }
.ld-footer-copy { font-size:0.75rem; color:var(--ink-4); margin:0; }

/* REVEAL */
.ld-page .reveal { opacity:0; transform:translateY(18px); transition:opacity 0.6s ease,transform 0.6s ease; }
.ld-page .reveal.in { opacity:1; transform:none; }

/* RADAR SWEEP */
@keyframes ld-sweepR { to { transform:rotate(360deg); } }

/* RESPONSIVE */
@media (max-width:960px) {
  .ld-nav-links { display:none; }
  .ld-hero { grid-template-columns:1fr; padding:100px 1.5rem 60px; gap:3rem; }
  .ld-hero-card-wrap { display:none; }
  .ld-features-layout { grid-template-columns:1fr; gap:2rem; }
  .ld-feat-panel { display:none; }
  .ld-metrics-grid { grid-template-columns:repeat(2,1fr); }
  .ld-m-cell { border-right:none; border-bottom:1px solid var(--border); }
  .ld-caps-grid { grid-template-columns:repeat(2,1fr); }
  .ld-how-grid, .ld-pricing-grid { grid-template-columns:1fr; }
  .ld-section { padding:60px 1.5rem; }
  .ld-footer { flex-direction:column; text-align:center; }
  .ld-footer-links { justify-content:center; flex-wrap:wrap; gap:1.5rem; }
}
`;

export default function LandingPage() {
  const [activeTab, setActiveTab] = useState<FeatureTab>("radar");

  useEffect(() => {
    const els = document.querySelectorAll(".ld-page .reveal");
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            const siblings = Array.from(
              e.target.parentElement?.children ?? []
            ).filter((c) => c.classList.contains("reveal"));
            const idx = siblings.indexOf(e.target as Element);
            (e.target as HTMLElement).style.transitionDelay = `${idx * 0.06}s`;
            e.target.classList.add("in");
            obs.unobserve(e.target);
          }
        });
      },
      { threshold: 0.08 }
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  const allTicker = [...TICKER_ITEMS, ...TICKER_ITEMS];

  return (
    <div className="ld-page">
      <style>{LANDING_CSS}</style>

      {/* ── NAV ── */}
      <nav className="ld-nav">
        <a href="#" className="ld-logo">
          <div className="ld-logo-mark" />
          Repodar
        </a>
        <div className="ld-nav-links">
          <a href="#features" className="ld-nav-link">Features</a>
          <a href="#how" className="ld-nav-link">How it works</a>
          <a href="#capabilities" className="ld-nav-link">Capabilities</a>
          <a href="#pricing" className="ld-nav-link">Pricing</a>
        </div>
        <div className="ld-nav-right">
          <Link href="/sign-in" className="ld-btn-nav-ghost">Sign in</Link>
          <Link href="/sign-up" className="ld-btn-nav-solid">Open Radar <span>→</span></Link>
        </div>
      </nav>

      {/* ── HERO ── */}
      <div className="ld-hero-wrap">
        <div className="ld-hero-glow" />
        <div className="ld-hero">
          {/* Left */}
          <div>
            <div className="ld-badge">
              <span className="ld-badge-dot" />
              v2.0 · Now Live
            </div>
            <h1 className="ld-h1">
              The pulse of the<br />
              <em>AI/ML ecosystem</em><br />
              in real time.
            </h1>
            <p className="ld-hero-desc">
              Repodar continuously monitors GitHub&apos;s AI ecosystem — surfacing
              rising repos, tracking star momentum, and alerting you before the
              crowd notices.
            </p>
            <div className="ld-hero-cta">
              <Link href="/sign-up" className="ld-btn-primary">Explore live radar →</Link>
              <a href="#features" className="ld-btn-secondary">See how it works</a>
            </div>
            <div className="ld-hero-meta">
              <div>
                <div className="ld-meta-num">12k+</div>
                <div className="ld-meta-label">AI repos tracked</div>
              </div>
              <div className="ld-meta-sep" />
              <div>
                <div className="ld-meta-num">4.2M</div>
                <div className="ld-meta-label">Stars indexed</div>
              </div>
              <div className="ld-meta-sep" />
              <div>
                <div className="ld-meta-num">&lt;1min</div>
                <div className="ld-meta-label">Signal latency</div>
              </div>
            </div>
          </div>

          {/* Right — dashboard card */}
          <div className="ld-hero-card-wrap">
            <div className="ld-hero-card">
              <div className="ld-hc-topbar">
                <div className="ld-hc-dots"><span /><span /><span /></div>
                <div className="ld-hc-url">repodar.vercel.app</div>
              </div>
              <div className="ld-hc-body">
                <div className="ld-hc-header">
                  <span className="ld-hc-title">AI/ML Overview</span>
                  <span className="ld-live-pip"><span />LIVE</span>
                </div>
                <div className="ld-hc-stats">
                  {[
                    { num: "12,847", label: "Repos",  delta: "↑ 143 today" },
                    { num: "4.2M",   label: "Stars",  delta: "↑ 28k today" },
                    { num: "892",    label: "Alerts", delta: "↑ 12 new"    },
                  ].map((s) => (
                    <div className="ld-hc-stat" key={s.label}>
                      <div className="ld-hcs-num">{s.num}</div>
                      <div className="ld-hcs-label">{s.label}</div>
                      <div className="ld-hcs-delta">{s.delta}</div>
                    </div>
                  ))}
                </div>
                <div>
                  {[
                    { icon: "⚡", bg: "rgba(79,142,247,0.15)",  col: "#4f8ef7", name: "vercel/ai",               stars: "★ 48.2k", d: "↑ +820", hot: true  },
                    { icon: "🤗", bg: "rgba(45,212,191,0.12)",  col: "#2dd4bf", name: "huggingface/transformers", stars: "★ 131k",  d: "↑ +340", hot: false },
                    { icon: "🔗", bg: "rgba(251,191,36,0.12)",  col: "#fbbf24", name: "langchain-ai/langchain",   stars: "★ 92.1k", d: "↑ +610", hot: true  },
                    { icon: "🧠", bg: "rgba(167,139,250,0.12)", col: "#a78bfa", name: "ollama/ollama",             stars: "★ 81.4k", d: "↑ +290", hot: false },
                  ].map((r) => (
                    <div className="ld-hc-repo" key={r.name}>
                      <div className="ld-ri" style={{ background: r.bg, color: r.col }}>{r.icon}</div>
                      <div className="ld-rn">{r.name}</div>
                      <div className="ld-rs">{r.stars}</div>
                      <div className={`ld-rt ${r.hot ? "ld-rt-hot" : "ld-rt-up"}`}>{r.d}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="ld-fc ld-fc-1">
              <div className="ld-fc-lbl">Trending now</div>
              <div className="ld-fc-val">qwen2.5-coder</div>
              <div className="ld-fc-sub">↑ +2,400 stars this week</div>
            </div>
            <div className="ld-fc ld-fc-2">
              <div className="ld-fc-lbl">New alert</div>
              <div className="ld-fc-val">unsloth/unsloth</div>
              <div className="ld-fc-sub">🔥 Passed 20k stars</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── TICKER ── */}
      <div className="ld-ticker">
        <div className="ld-ticker-track">
          {allTicker.map((item, i) => (
            <div key={i}>
              {i === 0 || i === TICKER_ITEMS.length
                ? <><span>Tracks →</span> {item}</>
                : item}
            </div>
          ))}
        </div>
      </div>

      {/* ── FEATURES ── */}
      <div id="features" className="ld-features-bg">
        <div className="ld-section">
          <p className="ld-s-label reveal">Features</p>
          <h2 className="ld-s-title reveal">
            Intelligence for the<br /><em>AI-native developer.</em>
          </h2>
          <p className="ld-s-desc reveal">
            Every view you need to understand momentum, catch breakouts, and stay
            permanently ahead of the curve.
          </p>

          <div className="ld-features-layout">
            {/* Tab list */}
            <div className="ld-feat-tabs">
              {(
                [
                  { id: "radar"    as const, icon: "📡", title: "Ecosystem Radar",  desc: "A live visual sweep of the AI/ML landscape. Watch repos pulse and rise in real time with momentum scores updated continuously from GitHub events." },
                  { id: "lb"       as const, icon: "🏆", title: "Live Leaderboard", desc: "See exactly which repos are climbing fastest. Filter by topic, language, or time window to surface what's truly breaking through noise." },
                  { id: "alerts"   as const, icon: "🔔", title: "Smart Alerts",     desc: "Get notified when a repo hits your thresholds — star velocity spikes, fork explosions, or new releases. Route to Slack, email, or webhook." },
                  { id: "insights" as const, icon: "📊", title: "Deep Insights",    desc: "Velocity charts, contributor graphs, and language breakdowns — all the analytics to understand what's really driving a project's growth." },
                ] as const
              ).map((tab) => (
                <div
                  key={tab.id}
                  className={`ld-feat-tab${activeTab === tab.id ? " active" : ""}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <span className="ld-ft-ico">{tab.icon}</span>
                  <h3>{tab.title}</h3>
                  <p>{tab.desc}</p>
                </div>
              ))}
            </div>

            {/* Panel */}
            <div className="ld-feat-panel">
              {activeTab === "radar" && (
                <div>
                  <div className="ld-fp-bar">
                    <span className="ld-fp-bar-title">Ecosystem Radar — Live</span>
                    <span className="ld-fp-chip" style={{ background: "var(--teal-dim)", color: "var(--teal)" }}>● LIVE</span>
                  </div>
                  <div className="ld-fp-body">
                    <div className="ld-radar-wrap">
                      <svg width="200" height="200" viewBox="-100 -100 200 200">
                        <circle r="95" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1"/>
                        <circle r="65" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1"/>
                        <circle r="35" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1"/>
                        <line x1="-95" y1="0" x2="95" y2="0" stroke="rgba(255,255,255,0.04)" strokeWidth="1"/>
                        <line x1="0" y1="-95" x2="0" y2="95" stroke="rgba(255,255,255,0.04)" strokeWidth="1"/>
                        <g style={{ animation: "ld-sweepR 5s linear infinite", transformOrigin: "0 0" }}>
                          <path d="M0,0 L0,-95 A95,95 0 0,1 67,-67 Z" fill="rgba(79,142,247,0.07)"/>
                          <line x1="0" y1="0" x2="0" y2="-95" stroke="rgba(79,142,247,0.4)" strokeWidth="1"/>
                        </g>
                        <circle cx="28" cy="-58" r="4" fill="#4f8ef7">
                          <animate attributeName="r" values="3;6;3" dur="2s" repeatCount="indefinite"/>
                          <animate attributeName="opacity" values="0.9;0.4;0.9" dur="2s" repeatCount="indefinite"/>
                        </circle>
                        <circle cx="-48" cy="28" r="5" fill="#fbbf24">
                          <animate attributeName="r" values="4;7;4" dur="2.6s" repeatCount="indefinite"/>
                          <animate attributeName="opacity" values="0.9;0.4;0.9" dur="2.6s" repeatCount="indefinite"/>
                        </circle>
                        <circle cx="68" cy="18" r="3" fill="#2dd4bf">
                          <animate attributeName="r" values="2;5;2" dur="1.9s" repeatCount="indefinite"/>
                          <animate attributeName="opacity" values="0.9;0.4;0.9" dur="1.9s" repeatCount="indefinite"/>
                        </circle>
                        <circle cx="-18" cy="-78" r="3.5" fill="#4f8ef7">
                          <animate attributeName="r" values="2.5;5;2.5" dur="3.1s" repeatCount="indefinite"/>
                        </circle>
                        <circle cx="52" cy="-50" r="4" fill="#f87171">
                          <animate attributeName="r" values="3;6;3" dur="2.3s" repeatCount="indefinite"/>
                        </circle>
                      </svg>
                    </div>
                    <div style={{ display: "flex", gap: "1.2rem", justifyContent: "center", flexWrap: "wrap", marginTop: "0.5rem" }}>
                      {[
                        { color: "#4f8ef7", label: "LLM Frameworks" },
                        { color: "#fbbf24", label: "Agents" },
                        { color: "#2dd4bf", label: "Tooling" },
                      ].map((dot) => (
                        <span key={dot.label} style={{ fontSize: "0.67rem", color: "var(--ink-3)", display: "flex", alignItems: "center", gap: "5px" }}>
                          <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: dot.color, display: "inline-block", boxShadow: `0 0 6px ${dot.color}` }} />
                          {dot.label}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "lb" && (
                <div>
                  <div className="ld-fp-bar">
                    <span className="ld-fp-bar-title">Leaderboard — Top Movers</span>
                    <span className="ld-fp-chip" style={{ background: "var(--teal-dim)", color: "var(--teal)" }}>This week</span>
                  </div>
                  <div className="ld-fp-body">
                    <div className="ld-lb">
                      <div className="ld-lb-row" style={{ paddingBottom: "0.3rem" }}>
                        <span className="ld-lb-n" style={{ fontSize: "0.6rem" }}>#</span>
                        <span style={{ width: 24 }} />
                        <span className="ld-lb-name" style={{ fontSize: "0.65rem", color: "var(--ink-3)" }}>Repository</span>
                        <span className="ld-lb-st">Stars</span>
                        <span className="ld-lb-ch">Δ week</span>
                      </div>
                      {[
                        { n: 1, icon: "⚡", bg: "rgba(79,142,247,0.15)",  col: "#4f8ef7", name: "vercel/ai",              stars: "48.2k", ch: "+1.8k" },
                        { n: 2, icon: "🔗", bg: "rgba(251,191,36,0.12)",  col: "#fbbf24", name: "langchain-ai/langchain", stars: "92.1k", ch: "+1.4k" },
                        { n: 3, icon: "🧠", bg: "rgba(167,139,250,0.12)", col: "#a78bfa", name: "ollama/ollama",           stars: "81.4k", ch: "+1.1k" },
                        { n: 4, icon: "🌿", bg: "rgba(45,212,191,0.12)",  col: "#2dd4bf", name: "microsoft/autogen",       stars: "34.6k", ch: "+980"  },
                        { n: 5, icon: "⚙️", bg: "rgba(248,113,113,0.12)", col: "#f87171", name: "crewAIInc/crewAI",        stars: "21.3k", ch: "+760"  },
                      ].map((row) => (
                        <div className="ld-lb-row" key={row.n}>
                          <span className="ld-lb-n">{row.n}</span>
                          <div className="ld-lb-ico" style={{ background: row.bg, color: row.col }}>{row.icon}</div>
                          <span className="ld-lb-name">{row.name}</span>
                          <span className="ld-lb-st">{row.stars}</span>
                          <span className="ld-lb-ch">{row.ch}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "alerts" && (
                <div>
                  <div className="ld-fp-bar">
                    <span className="ld-fp-bar-title">Alerts — Recent</span>
                    <span className="ld-fp-chip" style={{ background: "var(--amber-dim)", color: "var(--amber)" }}>3 new</span>
                  </div>
                  <div className="ld-fp-body">
                    <div className="ld-al">
                      {[
                        { bg: "var(--amber-dim)", col: "var(--amber)", icon: "🔥", name: "qwen2.5-coder",        desc: "Star velocity +2,400 in 24h — breaking into top 20",         time: "2m ago"  },
                        { bg: "var(--blue-dim)",  col: "var(--blue)",  icon: "⭐", name: "unsloth/unsloth",      desc: "Passed 20,000 stars milestone",                               time: "18m ago" },
                        { bg: "var(--red-dim)",   col: "var(--red)",   icon: "🚨", name: "openai/openai-python", desc: "Major release v2.0.0 — breaking changes detected",             time: "1h ago"  },
                        { bg: "var(--teal-dim)",  col: "var(--teal)",  icon: "📈", name: "mem0ai/mem0",          desc: "Fork count doubled in 48h — viral growth signal",             time: "3h ago"  },
                      ].map((a) => (
                        <div className="ld-al-row" key={a.name}>
                          <div className="ld-al-ico" style={{ background: a.bg, color: a.col }}>{a.icon}</div>
                          <div>
                            <div className="ld-al-name">{a.name}</div>
                            <div className="ld-al-desc">{a.desc}</div>
                          </div>
                          <span className="ld-al-time">{a.time}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "insights" && (
                <div>
                  <div className="ld-fp-bar">
                    <span className="ld-fp-bar-title">Insights — Star Velocity</span>
                    <span className="ld-fp-chip" style={{ background: "var(--blue-dim)", color: "var(--blue)" }}>30-day trend</span>
                  </div>
                  <div className="ld-fp-body">
                    <div style={{ fontSize: "0.7rem", color: "var(--ink-3)", marginBottom: "0.8rem", fontFamily: "var(--mono)" }}>
                      langchain-ai/langchain
                    </div>
                    <div className="ld-bars">
                      {[28,38,33,50,45,60,55,70,63,75,82,88,94,100].map((h, i) => (
                        <div key={i} className={`ld-bar${i >= 10 ? " hi" : ""}`} style={{ height: `${h}%` }} />
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: "2rem", marginTop: "0.5rem" }}>
                      <div>
                        <div style={{ fontFamily: "var(--serif)", fontSize: "1.6rem", color: "var(--ink)", letterSpacing: "-0.03em" }}>+14,200</div>
                        <div style={{ fontSize: "0.68rem", color: "var(--ink-3)" }}>Stars this month</div>
                      </div>
                      <div>
                        <div style={{ fontFamily: "var(--serif)", fontSize: "1.6rem", color: "var(--teal)", letterSpacing: "-0.03em" }}>+34%</div>
                        <div style={{ fontSize: "0.68rem", color: "var(--ink-3)" }}>vs last month</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── METRICS STRIP ── */}
      <div className="ld-metrics-strip">
        <div className="ld-metrics-grid">
          {[
            { num: "12",  sup: "k+",  label: "AI/ML repos tracked"          },
            { num: "4.2", sup: "M",   label: "GitHub stars indexed"          },
            { num: "98",  sup: "%",   label: "Alert accuracy rate"           },
            { num: "<1",  sup: "min", label: "Signal detection latency"      },
          ].map((m, i) => (
            <div className="ld-m-cell reveal" key={i}>
              <div className="ld-m-num">{m.num}<sup>{m.sup}</sup></div>
              <div className="ld-m-label">{m.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── HOW IT WORKS ── */}
      <section id="how">
        <div className="ld-section">
          <p className="ld-s-label reveal">How it works</p>
          <h2 className="ld-s-title reveal">
            From GitHub events to<br /><em>actionable intelligence.</em>
          </h2>
          <p className="ld-s-desc reveal">
            Repodar ingests GitHub&apos;s event stream continuously, processes it
            through AI-powered ranking, and delivers clear signals — directly to you.
          </p>
          <div className="ld-how-grid">
            {[
              { n: "01", icon: "🔌", title: "Connect instantly",    desc: "Open Repodar — no token or setup needed for public ecosystem tracking. Sign in to unlock watchlists and personal alerts.",                                 tag: "Zero config", tagBg: "var(--blue-dim)",  tagCol: "var(--blue)"  },
              { n: "02", icon: "⚡", title: "We scan continuously", desc: "Our pipeline monitors stars, forks, issues, and releases across 12k+ AI/ML repos — updated in real time, every minute of every day.",                       tag: "Real-time",   tagBg: "var(--teal-dim)",  tagCol: "var(--teal)"  },
              { n: "03", icon: "🎯", title: "Get smart signals",    desc: "Receive alerts when repos hit your thresholds. Browse the radar, leaderboard, and insights to spot breakouts before they go viral.",                        tag: "AI-powered",  tagBg: "var(--amber-dim)", tagCol: "var(--amber)" },
            ].map((c) => (
              <div className="ld-how-card reveal" data-n={c.n} key={c.n}>
                <span className="ld-hw-ico">{c.icon}</span>
                <h3>{c.title}</h3>
                <p>{c.desc}</p>
                <span className="ld-hw-tag" style={{ background: c.tagBg, color: c.tagCol }}>{c.tag}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CAPABILITIES ── */}
      <div id="capabilities" className="ld-caps-bg">
        <div className="ld-section">
          <p className="ld-s-label reveal">Capabilities</p>
          <h2 className="ld-s-title reveal">
            10+ purpose-built views.<br /><em>One unified radar.</em>
          </h2>
          <p className="ld-s-desc reveal">
            Every angle of the AI ecosystem — from broad trends to org-level health,
            all in a single platform.
          </p>
          <div className="ld-caps-grid">
            {[
              { icon: "🎯", name: "Overview",    desc: "Daily command center — top movers, trending topics, and ecosystem health."           },
              { icon: "📊", name: "Insights",    desc: "Star velocity, contributor graphs, and language breakdowns for any repo."            },
              { icon: "🏆", name: "Leaderboard", desc: "Ranked repos by stars, growth rate, forks, or community engagement."                },
              { icon: "📡", name: "Radar",        desc: "Live visual sweep — watch AI/ML momentum shift in real time."                       },
              { icon: "🏷️", name: "Topics",       desc: "Browse by category — LLMs, agents, fine-tuning, RAG, inference."                   },
              { icon: "🕸️", name: "Network",      desc: "Visualize dependency and fork networks to understand repo influence."               },
              { icon: "🏥", name: "Org Health",   desc: "Monitor GitHub orgs — activity trends, open issues, contributor retention."        },
              { icon: "🔍", name: "NL Search",    desc: "Ask plain-English questions and get instant, data-backed ecosystem answers."       },
            ].map((cap) => (
              <div className="ld-cap-cell reveal" key={cap.name}>
                <span className="ld-cap-ico">{cap.icon}</span>
                <div className="ld-cap-name">{cap.name}</div>
                <div className="ld-cap-desc">{cap.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── PRICING ── */}
      <div id="pricing" className="ld-pricing-bg">
        <div className="ld-section">
          <p className="ld-s-label reveal">Pricing</p>
          <h2 className="ld-s-title reveal">
            Simple. Always free<br /><em>to explore.</em>
          </h2>
          <p className="ld-s-desc reveal">
            The core radar is free forever. Upgrade when you need alerts, history,
            and team features.
          </p>
          <div className="ld-pricing-grid">
            <div className="ld-p-card reveal">
              <div className="ld-p-plan">Explorer</div>
              <div className="ld-p-price">$0</div>
              <div className="ld-p-note">Free forever · no account needed</div>
              <hr className="ld-p-divider" />
              <div className="ld-p-desc">Full access to the live radar, leaderboard, and trending topics.</div>
              <ul className="ld-p-feats">
                <li>Live ecosystem radar</li>
                <li>Leaderboard &amp; topics</li>
                <li>Basic insights</li>
                <li>Weekly digest</li>
                <li className="dim">Custom alerts</li>
                <li className="dim">Watchlist</li>
                <li className="dim">API access</li>
              </ul>
              <Link href="/sign-up" className="ld-p-btn ld-p-btn-ghost">Start exploring →</Link>
            </div>

            <div className="ld-p-card featured reveal">
              <div className="ld-p-plan">Pro</div>
              <div className="ld-p-price">$12</div>
              <div className="ld-p-note">per month · billed monthly</div>
              <hr className="ld-p-divider" style={{ borderColor: "rgba(255,255,255,0.08)" }} />
              <div className="ld-p-desc" style={{ color: "rgba(238,242,251,0.55)" }}>
                For developers and researchers who need alerts, history, and deep insights.
              </div>
              <ul className="ld-p-feats">
                <li>Everything in Explorer</li>
                <li>Custom alerts &amp; webhooks</li>
                <li>Full watchlist</li>
                <li>90-day history</li>
                <li>NL Search</li>
                <li>Compare repos</li>
                <li className="dim">Team seats</li>
              </ul>
              <Link href="/sign-up" className="ld-p-btn ld-p-btn-blue">Get Pro →</Link>
            </div>

            <div className="ld-p-card reveal">
              <div className="ld-p-plan">Team</div>
              <div className="ld-p-price">$39</div>
              <div className="ld-p-note">per month · up to 5 seats</div>
              <hr className="ld-p-divider" />
              <div className="ld-p-desc">For engineering teams and AI labs with shared watchlists and org monitoring.</div>
              <ul className="ld-p-feats">
                <li>Everything in Pro</li>
                <li>5 team seats</li>
                <li>Shared watchlists</li>
                <li>Org health monitoring</li>
                <li>Network graph export</li>
                <li>API access</li>
                <li>Priority support</li>
              </ul>
              <Link href="/sign-up" className="ld-p-btn ld-p-btn-ghost">Get Team →</Link>
            </div>
          </div>
        </div>
      </div>

      {/* ── CTA BAND ── */}
      <div className="ld-cta-band">
        <p className="ld-s-label" style={{ justifyContent: "center", marginBottom: "1.2rem" }}>
          Ready to start?
        </p>
        <h2 className="ld-s-title" style={{ textAlign: "center", maxWidth: "600px", margin: "0 auto 1rem" }}>
          The AI ecosystem moves fast.<br /><em>Repodar keeps you ahead.</em>
        </h2>
        <p className="ld-s-desc" style={{ textAlign: "center", maxWidth: "420px", margin: "0 auto 2.5rem" }}>
          Start exploring the live radar for free — no sign-up needed. Get alerts
          and advanced features when you&apos;re ready.
        </p>
        <div className="ld-cta-btns">
          <Link href="/sign-up" className="ld-btn-primary">Open live radar →</Link>
          <a href="#pricing" className="ld-btn-secondary">View pricing</a>
        </div>
      </div>

      {/* ── FOOTER ── */}
      <footer className="ld-footer">
        <a href="#" className="ld-logo">
          <div className="ld-logo-mark" />
          Repodar
        </a>
        <div className="ld-footer-links">
          <Link href="/sign-in">App</Link>
          <a href="#">Docs</a>
          <a href="#">Privacy</a>
          <a href="#">Terms</a>
          <a href="#">Status</a>
          <a href="https://github.com" target="_blank" rel="noopener noreferrer">GitHub</a>
        </div>
        <p className="ld-footer-copy">© 2025 Repodar · Real-time GitHub AI Radar</p>
      </footer>
    </div>
  );
}
