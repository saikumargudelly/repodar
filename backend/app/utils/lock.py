import asyncio

# Global in-memory lock to prevent concurrent overlapping pipeline executions
pipeline_lock = asyncio.Lock()
