import sys
import os
import asyncio
import logging

# Set up logging to stdout
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)

# Add app to path
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from app.main import _run_pipeline_sync

async def main():
    print("=" * 60)
    print("Starting Full Ingestion & Scoring Pipeline via CLI")
    print("=" * 60)
    
    try:
        result = await _run_pipeline_sync(include_explanations=True)
        print("\nPipeline completed successfully!")
        print(f"Result: {result}")
    except Exception as e:
        print(f"\nPipeline failed with exception: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    asyncio.run(main())
