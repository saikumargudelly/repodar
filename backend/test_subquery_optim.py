import os
import time
from datetime import date, timedelta
from sqlalchemy import create_engine, func, and_
from sqlalchemy.orm import sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./repodar.db")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

print("DATABASE_URL:", DATABASE_URL)
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

from app.models import Repository, ComputedMetric
from app.routers.dashboard import _latest_metric_subquery, _latest_scored_date

def main():
    latest_date = _latest_scored_date(db)
    print("Latest scored date:", latest_date)

    # 1. Benchmark original window subquery
    start = time.time()
    subq_orig = _latest_metric_subquery(db, latest_date)
    q1 = (
        db.query(
            Repository.id,
            Repository.owner,
            Repository.name,
            subq_orig.c.trend_score,
        )
        .outerjoin(subq_orig, Repository.id == subq_orig.c.repo_id)
        .filter(Repository.is_active == True)
    )
    rows1 = q1.all()
    end = time.time()
    print(f"Original window subquery took: {(end - start)*1000:.2f}ms. Rows: {len(rows1)}")

    # 2. Benchmark optimized direct join on latest_date
    start = time.time()
    q2 = (
        db.query(
            Repository.id,
            Repository.owner,
            Repository.name,
            ComputedMetric.trend_score,
        )
        .outerjoin(
            ComputedMetric,
            and_(
                Repository.id == ComputedMetric.repo_id,
                ComputedMetric.date == latest_date,
            ),
        )
        .filter(Repository.is_active == True)
    )
    rows2 = q2.all()
    end = time.time()
    print(f"Optimized direct join took: {(end - start)*1000:.2f}ms. Rows: {len(rows2)}")

    # Check if results are equivalent
    null_counts_orig = sum(1 for r in rows1 if r[3] is None)
    null_counts_opt = sum(1 for r in rows2 if r[3] is None)
    print(f"Null trend scores: Original={null_counts_orig}, Optimized={null_counts_opt}")

    db.close()

if __name__ == "__main__":
    main()

