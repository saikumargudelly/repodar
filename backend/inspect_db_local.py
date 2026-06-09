import sys
import os
from datetime import date
from sqlalchemy import func

# Add app to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), 'app')))
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from app.database import SessionLocal
from app.models import Repository, DailyMetric, ComputedMetric

def inspect():
    db = SessionLocal()
    try:
        total = db.query(Repository).count()
        active = db.query(Repository).filter(Repository.is_active == True).count()
        print(f"Total Repositories: {total}")
        print(f"Active Repositories: {active}")
        
        # Check sustainability labels in Repository
        labels = db.query(Repository.sustainability_label, func.count(Repository.id)).group_by(Repository.sustainability_label).all()
        print("\nRepository Sustainability Labels:")
        for label, count in labels:
            print(f"  {label}: {count}")
            
        # Check ComputedMetrics
        today = date.today()
        cm_count_today = db.query(ComputedMetric).filter(ComputedMetric.date == today).count()
        print(f"\nComputedMetrics for today ({today}): {cm_count_today}")
        
        cm_total = db.query(ComputedMetric).count()
        print(f"Total ComputedMetrics: {cm_total}")
        
        # Check distinct dates in ComputedMetric
        cm_dates = db.query(ComputedMetric.date, func.count(ComputedMetric.id)).group_by(ComputedMetric.date).order_by(ComputedMetric.date.desc()).limit(10).all()
        print("\nComputedMetric count by date (last 10):")
        for dt, count in cm_dates:
            print(f"  {dt}: {count}")
            
        # Check distinct dates in DailyMetric
        dm_dates = db.query(func.date(DailyMetric.captured_at), func.count(DailyMetric.id)).group_by(func.date(DailyMetric.captured_at)).order_by(func.date(DailyMetric.captured_at).desc()).limit(10).all()
        print("\nDailyMetric count by date (last 10):")
        for dt, count in dm_dates:
            print(f"  {dt}: {count}")
            
        # Sample ComputedMetrics today
        print("\nSample ComputedMetrics today:")
        samples = db.query(ComputedMetric).filter(ComputedMetric.date == today).limit(5).all()
        for s in samples:
            repo = db.query(Repository).filter(Repository.id == s.repo_id).first()
            name = f"{repo.owner}/{repo.name}" if repo else s.repo_id
            print(f"  {name}: trend={s.trend_score}, sustainability={s.sustainability_score}, label={s.sustainability_label}")
            
    finally:
        db.close()

if __name__ == '__main__':
    inspect()
