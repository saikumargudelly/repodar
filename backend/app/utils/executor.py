import asyncio
import logging
import threading
from concurrent.futures import ThreadPoolExecutor
from functools import partial

logger = logging.getLogger(__name__)

# Dedicated thread pool executor for background pipeline tasks to avoid starving API requests
pipeline_executor = ThreadPoolExecutor(max_workers=3, thread_name_prefix="pipeline-worker")

_running_tasks = 0
_completed_tasks = 0
_stats_lock = threading.Lock()

def _executor_wrapper(func, *args, **kwargs):
    global _running_tasks, _completed_tasks
    with _stats_lock:
        _running_tasks += 1
    try:
        return func(*args, **kwargs)
    finally:
        with _stats_lock:
            _running_tasks = max(0, _running_tasks - 1)
            _completed_tasks += 1

async def run_in_pipeline_thread(func, *args, **kwargs):
    """
    Offload a synchronous/blocking database or CPU task to the dedicated background pipeline ThreadPoolExecutor.
    """
    loop = asyncio.get_running_loop()
    fn = partial(_executor_wrapper, func, *args, **kwargs)
    return await loop.run_in_executor(pipeline_executor, fn)

def get_executor_stats() -> dict:
    with _stats_lock:
        running = _running_tasks
        completed = _completed_tasks
    
    queued = 0
    if hasattr(pipeline_executor, "_work_queue"):
        queued = getattr(pipeline_executor._work_queue, "qsize", lambda: 0)()
        
    return {
        "max_workers": getattr(pipeline_executor, "_max_workers", 3),
        "active_threads": running,
        "queued_tasks": queued,
        "completed_tasks": completed
    }
