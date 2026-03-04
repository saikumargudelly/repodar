"""
Seed script – reads repos.yaml and inserts missing repos into the DB.
Safe to run multiple times (idempotent: skips existing owner/name pairs).
"""

import os
import sys
import yaml
import logging
from pathlib import Path

# Allow running directly: python -m app.seed.seeder
sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

from app.database import SessionLocal, engine
from app.models import Repository
from app.models.repository import Base  # noqa – triggers Base registration

logger = logging.getLogger(__name__)

YAML_PATH = Path(__file__).parent / "repos.yaml"


def seed_repos() -> int:
    """Insert missing repos from repos.yaml. Returns count of newly inserted rows."""
    with open(YAML_PATH, "r") as f:
        data = yaml.safe_load(f)

    repos_data = data.get("repositories", [])
    db = SessionLocal()
    inserted = 0

    try:
        for item in repos_data:
            owner = item["owner"].strip()
            name = item["name"].strip()

            existing = (
                db.query(Repository)
                .filter_by(owner=owner, name=name)
                .first()
            )
            if existing:
                # Ensure legacy rows are correctly tagged as seed source
                if existing.source != "seed":
                    existing.source = "seed"
                    existing.is_active = True
                continue

            repo = Repository(
                owner=owner,
                name=name,
                category=item["category"].strip(),
                description=item.get("description", ""),
                github_url=f"https://github.com/{owner}/{name}",
                source="seed",
                is_active=True,
            )
            db.add(repo)
            inserted += 1

        db.commit()
        logger.info(f"Seed complete: {inserted} new repos inserted ({len(repos_data)} total in YAML)")
        return inserted
    except Exception as e:
        db.rollback()
        logger.error(f"Seed failed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    from app.database import engine
    import app.models  # ensure all models are registered
    from app.database import Base
    Base.metadata.create_all(bind=engine)

    logging.basicConfig(level=logging.INFO)
    count = seed_repos()
    print(f"✅ Inserted {count} repos.")
