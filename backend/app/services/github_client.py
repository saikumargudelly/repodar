"""
GitHub API client.
- Primary: GraphQL for batch metadata (stars, forks, watchers, issues, releases)
- REST fallback + contributor count + merged PR count
- Rate-limit aware with exponential backoff via tenacity
"""

import os
import re
import asyncio
import logging
from typing import Optional

import aiohttp
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
    before_sleep_log,
)
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "")
GRAPHQL_URL = "https://api.github.com/graphql"
REST_BASE = "https://api.github.com"

HEADERS = {
    "Authorization": f"Bearer {GITHUB_TOKEN}",
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
}

# ─── GraphQL batch query ────────────────────────────────────────────────────

def _build_graphql_query(repos: list[dict]) -> str:
    """Build a single GraphQL query fetching all repos in one request."""
    fragments = []
    for i, r in enumerate(repos):
        alias = f"r{i}"
        fragments.append(f"""
  {alias}: repository(owner: "{r['owner']}", name: "{r['name']}") {{
    stargazerCount
    forkCount
    watchers {{ totalCount }}
    openIssuesCount: issues(states: OPEN) {{ totalCount }}
    releases {{ totalCount }}
    primaryLanguage {{ name }}
    languages(first: 10, orderBy: {{field: SIZE, direction: DESC}}) {{
      edges {{ size node {{ name }} }}
    }}
    createdAt
  }}""")
    body = "\n".join(fragments)
    return f"query {{\n{body}\n}}"


# ─── Retry decorator ────────────────────────────────────────────────────────

def _make_retry():
    return retry(
        retry=retry_if_exception_type((aiohttp.ClientError, asyncio.TimeoutError)),
        stop=stop_after_attempt(4),
        wait=wait_exponential(multiplier=2, min=4, max=60),
        before_sleep=before_sleep_log(logger, logging.WARNING),
    )


# ─── REST helpers ───────────────────────────────────────────────────────────

async def _get_contributor_count(session: aiohttp.ClientSession, owner: str, name: str) -> int:
    """
    Uses the contributors endpoint with per_page=1 and reads the last page
    number from the Link header — avoids downloading all contributor records.
    """
    url = f"{REST_BASE}/repos/{owner}/{name}/contributors?per_page=1&anon=true"
    try:
        async with session.get(url, headers=HEADERS, timeout=aiohttp.ClientTimeout(total=15)) as resp:
            if resp.status == 204:
                return 0
            if resp.status != 200:
                logger.warning(f"Contributors {owner}/{name}: HTTP {resp.status}")
                return 0
            link = resp.headers.get("Link", "")
            if not link:
                # only one page → just count the body
                data = await resp.json()
                return len(data)
            # Parse last page number from Link header
            m = re.search(r'page=(\d+)>; rel="last"', link)
            return int(m.group(1)) if m else 1
    except Exception as e:
        logger.warning(f"Contributors fetch failed for {owner}/{name}: {e}")
        return 0


async def _get_merged_pr_count(session: aiohttp.ClientSession, owner: str, name: str) -> int:
    """Gets total closed (merged) PRs via search API."""
    url = f"{REST_BASE}/search/issues?q=repo:{owner}/{name}+type:pr+is:merged&per_page=1"
    try:
        async with session.get(url, headers=HEADERS, timeout=aiohttp.ClientTimeout(total=15)) as resp:
            if resp.status != 200:
                return 0
            data = await resp.json()
            return data.get("total_count", 0)
    except Exception as e:
        logger.warning(f"Merged PRs fetch failed for {owner}/{name}: {e}")
        return 0


async def _get_repo_rest_fallback(session: aiohttp.ClientSession, owner: str, name: str) -> Optional[dict]:
    """REST fallback for when GraphQL fails for a specific repo."""
    url = f"{REST_BASE}/repos/{owner}/{name}"
    try:
        async with session.get(url, headers=HEADERS, timeout=aiohttp.ClientTimeout(total=15)) as resp:
            if resp.status != 200:
                logger.warning(f"REST fallback {owner}/{name}: HTTP {resp.status}")
                return None
            data = await resp.json()
            return {
                "stars": data.get("stargazers_count", 0),
                "forks": data.get("forks_count", 0),
                "watchers": data.get("subscribers_count", 0),
                "open_issues": data.get("open_issues_count", 0),
                "releases": 0,
                "primary_language": data.get("language"),
                "language_breakdown": {},
                "repo_created_at": data.get("created_at", ""),
            }
    except Exception as e:
        logger.warning(f"REST fallback failed for {owner}/{name}: {e}")
        return None


# ─── Language breakdown ──────────────────────────────────────────────────────

def _parse_language_breakdown(language_edges: list) -> dict:
    total = sum(e["size"] for e in language_edges)
    if total == 0:
        return {}
    return {
        e["node"]["name"]: round(e["size"] / total * 100, 1)
        for e in language_edges
    }


# ─── Main fetch function ─────────────────────────────────────────────────────

async def fetch_repo_metrics(repos: list[dict]) -> list[dict]:
    """
    Fetches metrics for a list of {owner, name, id} dicts.
    Returns a list of enriched dicts keyed by repo_id.
    """
    results = {}

    async with aiohttp.ClientSession() as session:
        # ── GraphQL batch (chunks of 25 to avoid query size limits) ──
        chunk_size = 25
        for chunk_start in range(0, len(repos), chunk_size):
            chunk = repos[chunk_start: chunk_start + chunk_size]
            query = _build_graphql_query(chunk)

            graphql_data = {}
            try:
                async with session.post(
                    GRAPHQL_URL,
                    json={"query": query},
                    headers=HEADERS,
                    timeout=aiohttp.ClientTimeout(total=30),
                ) as resp:
                    if resp.status == 200:
                        payload = await resp.json()
                        graphql_data = payload.get("data", {}) or {}
                    else:
                        logger.warning(f"GraphQL chunk failed: HTTP {resp.status}")
            except Exception as e:
                logger.warning(f"GraphQL request error: {e}")

            # ── Parse GraphQL results per repo in chunk ──
            for i, repo in enumerate(chunk):
                alias = f"r{i}"
                gdata = graphql_data.get(alias)

                if gdata:
                    lang_edges = gdata.get("languages", {}).get("edges", [])
                    parsed = {
                        "repo_id": repo["id"],
                        "owner": repo["owner"],
                        "name": repo["name"],
                        "stars": gdata.get("stargazerCount", 0),
                        "forks": gdata.get("forkCount", 0),
                        "watchers": gdata.get("watchers", {}).get("totalCount", 0),
                        "open_issues": gdata.get("openIssuesCount", {}).get("totalCount", 0),
                        "releases": gdata.get("releases", {}).get("totalCount", 0),
                        "primary_language": (gdata.get("primaryLanguage") or {}).get("name"),
                        "language_breakdown": _parse_language_breakdown(lang_edges),
                        "repo_created_at": gdata.get("createdAt", ""),
                    }
                else:
                    # REST fallback
                    logger.info(f"Using REST fallback for {repo['owner']}/{repo['name']}")
                    rest = await _get_repo_rest_fallback(session, repo["owner"], repo["name"])
                    if rest is None:
                        logger.error(f"Both GraphQL and REST failed for {repo['owner']}/{repo['name']}")
                        continue
                    parsed = {"repo_id": repo["id"], "owner": repo["owner"], "name": repo["name"], **rest}

                results[repo["id"]] = parsed

            # ── Rate limit courtesy pause between chunks ──
            if chunk_start + chunk_size < len(repos):
                await asyncio.sleep(1)

        # ── Contributor counts (parallel, REST) ──
        async def enrich_contributors(repo_id: str, owner: str, name: str):
            count = await _get_contributor_count(session, owner, name)
            if repo_id in results:
                results[repo_id]["contributors"] = count

        await asyncio.gather(*[
            enrich_contributors(r["id"], r["owner"], r["name"]) for r in repos
        ])

        # ── Merged PR counts (parallel, REST) ──
        async def enrich_merged_prs(repo_id: str, owner: str, name: str):
            count = await _get_merged_pr_count(session, owner, name)
            if repo_id in results:
                results[repo_id]["merged_prs"] = count

        await asyncio.gather(*[
            enrich_merged_prs(r["id"], r["owner"], r["name"]) for r in repos
        ])

    return list(results.values())
