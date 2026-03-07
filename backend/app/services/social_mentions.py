"""
Social mention fetcher — queries Hacker News (Algolia) and Reddit for posts
referencing tracked repos. Stores results in social_mentions table.
"""
import asyncio
import logging
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional

import aiohttp

logger = logging.getLogger(__name__)

HN_SEARCH_URL = "https://hn.algolia.com/api/v1/search"
REDDIT_SEARCH_URL = "https://www.reddit.com/search.json"
REDDIT_SUBREDDITS = ["MachineLearning", "LocalLLaMA", "artificial", "learnmachinelearning", "mlops"]

_HEADERS = {"User-Agent": "Repodar-Bot/1.0 (+https://repodar.vercel.app)"}


def _utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


async def _fetch_hn_mentions(session: aiohttp.ClientSession, owner: str, name: str) -> list[dict]:
    """Search HN for stories mentioning owner/name or github.com/owner/name."""
    results = []
    for query in [f"{owner}/{name}", f"github.com/{owner}/{name}"]:
        try:
            async with session.get(
                HN_SEARCH_URL,
                params={"query": query, "tags": "story", "hitsPerPage": 10},
                headers=_HEADERS,
                timeout=aiohttp.ClientTimeout(total=8),
            ) as resp:
                if resp.status != 200:
                    continue
                data = await resp.json()
                for hit in data.get("hits", []):
                    # Only include hits that reference the repo URL in title or URL
                    url = hit.get("url", "")
                    title = hit.get("title", "")
                    if owner.lower() not in url.lower() and name.lower() not in url.lower():
                        if name.lower() not in title.lower():
                            continue
                    created_at_str = hit.get("created_at", "")
                    try:
                        posted_at = datetime.fromisoformat(created_at_str.replace("Z", "+00:00"))
                        posted_at = posted_at.replace(tzinfo=None)
                    except Exception:
                        posted_at = _utcnow()
                    results.append({
                        "platform": "hn",
                        "post_title": title,
                        "post_url": f"https://news.ycombinator.com/item?id={hit.get('objectID')}",
                        "upvotes": hit.get("points", 0) or 0,
                        "comment_count": hit.get("num_comments", 0) or 0,
                        "subreddit": None,
                        "posted_at": posted_at,
                    })
        except Exception as e:
            logger.debug(f"HN search failed for {owner}/{name}: {e}")
    return results


async def _fetch_reddit_mentions(session: aiohttp.ClientSession, owner: str, name: str) -> list[dict]:
    """Search Reddit across ML subreddits for posts mentioning the repo."""
    results = []
    query = f"{owner}/{name}"
    for subreddit in REDDIT_SUBREDDITS:
        try:
            async with session.get(
                f"https://www.reddit.com/r/{subreddit}/search.json",
                params={"q": query, "restrict_sr": "1", "sort": "new", "limit": 5},
                headers=_HEADERS,
                timeout=aiohttp.ClientTimeout(total=8),
            ) as resp:
                if resp.status != 200:
                    continue
                data = await resp.json()
                for post in data.get("data", {}).get("children", []):
                    pd = post.get("data", {})
                    title = pd.get("title", "")
                    selftext = pd.get("selftext", "")
                    url = pd.get("url", "")
                    if name.lower() not in title.lower() and name.lower() not in selftext.lower() and owner.lower() not in url.lower():
                        continue
                    created_utc = pd.get("created_utc", 0)
                    posted_at = datetime.utcfromtimestamp(created_utc) if created_utc else _utcnow()
                    results.append({
                        "platform": "reddit",
                        "post_title": title,
                        "post_url": f"https://www.reddit.com{pd.get('permalink', '')}",
                        "upvotes": pd.get("score", 0) or 0,
                        "comment_count": pd.get("num_comments", 0) or 0,
                        "subreddit": subreddit,
                        "posted_at": posted_at,
                    })
        except asyncio.TimeoutError:
            pass
        except Exception as e:
            logger.debug(f"Reddit search failed for {owner}/{name} in r/{subreddit}: {e}")
    return results


async def fetch_social_mentions_for_repo(
    session: aiohttp.ClientSession, repo_id: str, owner: str, name: str
) -> list[dict]:
    """Fetch HN + Reddit mentions in parallel for one repo."""
    hn, reddit = await asyncio.gather(
        _fetch_hn_mentions(session, owner, name),
        _fetch_reddit_mentions(session, owner, name),
        return_exceptions=True,
    )
    mentions = []
    if isinstance(hn, list):
        mentions.extend(hn)
    if isinstance(reddit, list):
        mentions.extend(reddit)
    for m in mentions:
        m["repo_id"] = repo_id
    return mentions


async def run_social_mentions_pipeline(top_n: int = 50) -> dict:
    """
    Fetch social mentions for the top-N trending repos.
    Skips repos that were fetched within the last 24 hours.
    """
    from app.database import SessionLocal
    from app.models import Repository, ComputedMetric
    from app.models.social_mention import SocialMention
    from datetime import date

    db = SessionLocal()
    written = 0
    skipped = 0

    try:
        today = date.today()
        yesterday = _utcnow() - timedelta(days=1)

        # Get top repos by trend score
        top = (
            db.query(ComputedMetric, Repository)
            .join(Repository, Repository.id == ComputedMetric.repo_id)
            .filter(ComputedMetric.date == today, Repository.is_active == True)
            .order_by(ComputedMetric.trend_score.desc())
            .limit(top_n)
            .all()
        )

        async with aiohttp.ClientSession() as session:
            for cm, repo in top:
                # Check if we fetched recently
                recent = (
                    db.query(SocialMention)
                    .filter(
                        SocialMention.repo_id == repo.id,
                        SocialMention.fetched_at >= yesterday,
                    )
                    .first()
                )
                if recent:
                    skipped += 1
                    continue

                mentions = await fetch_social_mentions_for_repo(session, repo.id, repo.owner, repo.name)
                now = _utcnow()
                for m in mentions:
                    # Deduplicate by post_url
                    exists = db.query(SocialMention).filter_by(post_url=m["post_url"]).first()
                    if not exists:
                        sm = SocialMention(
                            id=str(uuid.uuid4()),
                            repo_id=repo.id,
                            platform=m["platform"],
                            post_title=m.get("post_title"),
                            post_url=m["post_url"],
                            upvotes=m.get("upvotes", 0),
                            comment_count=m.get("comment_count", 0),
                            subreddit=m.get("subreddit"),
                            posted_at=m["posted_at"],
                            fetched_at=now,
                        )
                        db.add(sm)
                        written += 1

        db.commit()
        logger.info(f"Social mentions: {written} new, {skipped} repos skipped (recently fetched)")
        return {"written": written, "skipped": skipped}

    except Exception as e:
        db.rollback()
        logger.error(f"Social mentions pipeline failed: {e}")
        return {"written": 0, "error": str(e)}
    finally:
        db.close()
