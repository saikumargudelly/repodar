import sys
import os
import asyncio
import logging
from dotenv import load_dotenv

# Configure logging to stdout
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    stream=sys.stdout
)

# Add app to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../app')))

load_dotenv()

async def main():
    from app.main import _run_pipeline_sync
    print("Running pipeline sync local...", flush=True)
    res = await _run_pipeline_sync(include_explanations=False)
    print(f"Pipeline result: {res}", flush=True)

if __name__ == "__main__":
    asyncio.run(main())
