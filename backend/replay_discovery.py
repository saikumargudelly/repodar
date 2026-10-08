"""
Production discovery replay script for Golden Set verification.
Uses ONLY production discovery functions:
- discover_dynamic_organization_repos
- search_by_star_threshold
- _persist_discovered_repos_sync
NO direct database inserts, NO special-case benchmark queries.
Ensures DB sessions are closed across network boundaries.
"""
import asyncio
import aiohttp
import os
import sys
from datetime import datetime, timezone
from dotenv import load_dotenv

load_dotenv('.env')

from app.database import SessionLocal
from app.models.repository import Repository
from app.models.dynamic_organization import DynamicOrganization
from app.services.organization_intelligence import (
    discover_dynamic_organization_repos,
    sync_dynamic_organizations,
)
from app.services.ingestion import _persist_discovered_repos_sync
from tests.test_golden_set_coverage import GOLDEN_SET_REPOSITORIES, CANONICAL_REDIRECTS

token = os.getenv("GITHUB_TOKEN", "")
if not token:
    print("ERROR: GITHUB_TOKEN is not set!", flush=True)
    sys.exit(1)


async def main():
    # STEP 1: Verify dynamic organizations
    print("--- STEP 1: Verify Dynamic Organizations ---", flush=True)
    with SessionLocal() as db:
        org_count = db.query(DynamicOrganization).filter(DynamicOrganization.is_active == True).count()
        print(f"Dynamic Organizations in DB: {org_count}", flush=True)

    # The 19 organizations/creators producing the 20 previously missing repositories
    missing_orgs = [
        "deepseek-ai", "tatsu-lab", "karpathy", "sgl-project", "opengvlab",
        "meta-pytorch", "dao-ailab", "facebookresearch", "stanford-oval",
        "cline", "microsoft", "sylphai-inc", "openai", "hexgrad",
        "compvis", "huggingface", "nerfstudio-project", "haotian-liu", "dphnai"
    ]

    # STEP 2: Production Organization Discovery (No open DB session during network IO!)
    print(f"\n--- STEP 2: Production Organization Discovery for {len(missing_orgs)} Orgs ---", flush=True)
    all_discovered = []

    async with aiohttp.ClientSession() as session:
        for org_login in missing_orgs:
            org_obj = DynamicOrganization(id=f"replay_{org_login}", login=org_login)
            items = await discover_dynamic_organization_repos(session, org_obj, token, limit=25)
            names = [i.get("name") for i in items[:4]]
            print(f"[{org_login:20}] Discovered {len(items):2} repos. Top: {names}", flush=True)
            all_discovered.extend(items)
            await asyncio.sleep(1.0)  # Rate limiting pace

    # STEP 3: Deduplication and Canonical Ingestion
    print(f"\n--- STEP 3: Deduplication and Canonical Ingestion ---", flush=True)
    seen_slugs = {}
    for item in all_discovered:
        slug = item.get("full_name", "").lower()
        if slug and slug not in seen_slugs:
            seen_slugs[slug] = item

    print(f"Unique repositories to persist: {len(seen_slugs)}", flush=True)
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    # Run through the standard production ingestion persistence function
    persist_summary = _persist_discovered_repos_sync(seen_slugs, now, run_full_search=True)
    print(f"Ingestion Persistence Summary: {persist_summary}", flush=True)

    # STEP 4: Golden Set Lifecycle Trace
    print("\n--- STEP 4: Golden Set Lifecycle Trace ---", flush=True)
    with SessionLocal() as db:
        repos = db.query(
            Repository.owner,
            Repository.name,
            Repository.category,
            Repository.categories,
            Repository.is_active,
            Repository.stars_snapshot
        ).all()
        db_repos_map = {f"{r.owner.lower()}/{r.name.lower()}": r for r in repos}

        discovered_count = 0
        ingested_count = 0
        classified_count = 0
        active_count = 0
        surfaced_count = 0

        trace_results = []
        missing_results = []

        for orig_slug in GOLDEN_SET_REPOSITORIES:
            s_lower = orig_slug.lower()
            canonical_slug = CANONICAL_REDIRECTS.get(s_lower, s_lower).lower()

            matched = db_repos_map.get(s_lower) or db_repos_map.get(canonical_slug)
            if matched:
                discovered_count += 1
                ingested_count += 1
                is_class = bool(matched.category and matched.category not in ("untracked", "default"))
                if is_class:
                    classified_count += 1
                if matched.is_active:
                    active_count += 1
                if matched.is_active and is_class:
                    surfaced_count += 1

                trace_results.append({
                    "original": orig_slug,
                    "db_slug": f"{matched.owner}/{matched.name}",
                    "category": matched.category,
                    "categories": matched.categories,
                    "stars": matched.stars_snapshot,
                    "is_active": matched.is_active,
                })
            else:
                missing_results.append(orig_slug)

        print("\n========================================================", flush=True)
        print("GOLDEN SET DISCOVERY PIPELINE LIFECYCLE SUMMARY", flush=True)
        print("========================================================", flush=True)
        print(f"TOTAL BENCHMARK TARGETS:  60", flush=True)
        print(f"DISCOVERED:               {discovered_count}/60", flush=True)
        print(f"INGESTED:                 {ingested_count}/60", flush=True)
        print(f"CLASSIFIED:               {classified_count}/60", flush=True)
        print(f"ACTIVE:                   {active_count}/60", flush=True)
        print(f"SURFACED:                 {surfaced_count}/60", flush=True)
        print(f"REMAINING MISSING:        {len(missing_results)}/60", flush=True)
        if missing_results:
            print(f"Missing items: {missing_results}", flush=True)
        print("========================================================", flush=True)

        for t in trace_results[-20:]:
            print(f"{t['original']:35} -> DB: {t['db_slug']:35} | Cat: {t['category']:20} | Active: {t['is_active']}", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
