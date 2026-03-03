"""
Quick sanity-check script — run from backend/ directory:
    .venv/bin/python test_github.py
Tests:
  1. GitHub token validity (REST /user)
  2. Fetches live metrics for 3 sample repos via the actual github_client
"""

import asyncio
import os
from dotenv import load_dotenv

load_dotenv()

GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "")

# ── 1. Token check ────────────────────────────────────────────────────────────

async def check_token():
    import aiohttp
    headers = {
        "Authorization": f"Bearer {GITHUB_TOKEN}",
        "Accept": "application/vnd.github+json",
    }
    async with aiohttp.ClientSession() as session:
        async with session.get("https://api.github.com/rate_limit", headers=headers) as resp:
            if resp.status != 200:
                print(f"[FAIL] Token invalid — HTTP {resp.status}")
                return False
            data = await resp.json()
            core = data["resources"]["core"]
            graphql = data["resources"]["graphql"]
            print(f"[OK]  Token valid!")
            print(f"      REST  rate limit: {core['remaining']}/{core['limit']} remaining")
            print(f"      GraphQL rate limit: {graphql['remaining']}/{graphql['limit']} remaining")
            return True


# ── 2. Fetch metrics for 3 repos ─────────────────────────────────────────────

async def fetch_sample_repos():
    from app.services.github_client import fetch_repo_metrics

    sample = [
        {"id": "test-1", "owner": "meta-llama",  "name": "llama3"},
        {"id": "test-2", "owner": "mistralai",   "name": "mistral-src"},
        {"id": "test-3", "owner": "vllm-project", "name": "vllm"},
    ]

    print("\nFetching metrics for 3 sample repos...")
    results = await fetch_repo_metrics(sample)

    if not results:
        print("[FAIL] No results returned — check token or network.")
        return

    for r in results:
        print(
            f"\n  {r['owner']}/{r['name']}"
            f"\n    Stars       : {r.get('stars', 'N/A')}"
            f"\n    Forks       : {r.get('forks', 'N/A')}"
            f"\n    Watchers    : {r.get('watchers', 'N/A')}"
            f"\n    Open Issues : {r.get('open_issues', 'N/A')}"
            f"\n    Language    : {r.get('primary_language', 'N/A')}"
            f"\n    Contributors: {r.get('contributors', 'N/A')}"
            f"\n    Merged PRs  : {r.get('merged_prs', 'N/A')}"
        )
    print(f"\n[OK]  Successfully fetched {len(results)}/3 repos.")


# ── Main ──────────────────────────────────────────────────────────────────────

async def main():
    print("=" * 50)
    print("GitHub Connectivity Test")
    print("=" * 50)

    ok = await check_token()
    if ok:
        await fetch_sample_repos()

asyncio.run(main())
