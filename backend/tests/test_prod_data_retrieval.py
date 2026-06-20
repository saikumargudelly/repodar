import os
import pytest
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Load environmental variables
load_dotenv()

@pytest.mark.skipif(not os.getenv("DATABASE_URL"), reason="DATABASE_URL not set in .env")
def test_production_db_overview_retrieval():
    """
    Test case to retrieve data that is shown in the frontend from the production DB.
    Verifies that lookback window expansion is working and scores are populated.
    """
    import dotenv
    config = dotenv.dotenv_values("backend/.env")
    if not config.get("DATABASE_URL"):
        config = dotenv.dotenv_values(".env")
    database_url = config.get("DATABASE_URL")
    assert database_url is not None, "DATABASE_URL not found in .env"
    assert database_url.startswith("postgresql"), "Must be a PostgreSQL database"
    
    engine = create_engine(database_url)
    from app.database import ensure_db_schema_upgraded
    ensure_db_schema_upgraded(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        from app.models import Repository, ComputedMetric
        from app.routers.dashboard import _latest_scored_date, _latest_metric_subquery
        
        # 1. Latest scored date should exist
        latest_date = _latest_scored_date(session)
        assert latest_date is not None
        
        # 2. Latest metric subquery with 90-day lookback must return metrics
        subq = _latest_metric_subquery(session, latest_date)
        
        # Check active repos with latest computed metrics joined
        q = (
            session.query(
                Repository,
                subq.c.trend_score,
                subq.c.sustainability_score,
                subq.c.sustainability_label
            )
            .join(subq, Repository.id == subq.c.repo_id)
            .filter(Repository.is_active == True)
        )
        
        results = q.all()
        assert len(results) > 0, "No scored repositories found within 90 days lookback window"
        
        # Verify that trend scores are actually populated (not all zero/None)
        non_zero_trends = [r[1] for r in results if r[1] is not None and r[1] > 0]
        assert len(non_zero_trends) > 0, "All repositories have null or zero trend scores"
        
        # 3. Healthy repos count globally (GREEN + HIGH)
        healthy_count = session.query(Repository).join(subq, Repository.id == subq.c.repo_id).filter(
            Repository.is_active == True,
            subq.c.sustainability_label.in_(["GREEN", "HIGH"])
        ).count()
        assert healthy_count > 0, "No GREEN or HIGH sustainability repos found"
        
        # Print for pytest stdout output
        print(f"\n[Test Result] Retrieved {len(results)} scored repositories from production DB.")
        print(f"[Test Result] Global Healthy Repos count: {healthy_count}")
        print(f"[Test Result] Top repository: {results[0][0].owner}/{results[0][0].name} with trend={results[0][1]}")
        
    finally:
        session.close()
        engine.dispose()
