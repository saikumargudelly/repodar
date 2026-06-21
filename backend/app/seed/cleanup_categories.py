import logging
from app.database import SessionLocal
from app.models import Repository, CategoryMetricDaily
from app.services.scoring import _write_category_metrics_cache

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("cleanup_categories")

def main():
    db = SessionLocal()
    try:
        # 1. Update Repository Categories
        mappings = {
            "ai_ml": "AI / ML",
            "web_mobile": "Web & Mobile",
            "general": "DevTools",
            "default": "DevTools",
        }
        
        updated_repos = 0
        for old_cat, new_cat in mappings.items():
            repos = db.query(Repository).filter(Repository.category == old_cat).all()
            for r in repos:
                logger.info(f"Updating repo {r.owner}/{r.name}: category {old_cat} -> {new_cat}")
                r.category = new_cat
                updated_repos += 1
                
        logger.info(f"Updated {updated_repos} repositories in database.")
        
        # 2. Delete Stale Category Metrics Cache Rows
        stale_cats = ["ai_ml", "web_mobile", "general", "default", "system"]
        deleted_cache_rows = db.query(CategoryMetricDaily).filter(CategoryMetricDaily.category.in_(stale_cats)).delete(synchronize_session=False)
        logger.info(f"Deleted {deleted_cache_rows} stale rows from category_metrics_daily.")
        
        # Commit the repository updates and deletions
        db.commit()
        
        # 3. Regenerate Category Metrics Cache for canonical categories
        logger.info("Regenerating category metrics cache...")
        written = _write_category_metrics_cache(db, days=7)
        logger.info(f"Successfully wrote {written} category metric cache entries.")
        
        db.commit()
        logger.info("Category cleanup migration completed successfully!")
    except Exception as e:
        db.rollback()
        logger.error(f"Migration failed: {e}", exc_info=True)
    finally:
        db.close()

if __name__ == "__main__":
    main()
