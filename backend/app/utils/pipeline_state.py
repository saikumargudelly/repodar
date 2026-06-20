from datetime import datetime, timezone
from typing import Optional

class PipelineLifecycleTracker:
    def __init__(self):
        self.running = False
        self.stage = "idle"
        self.started_at: Optional[datetime] = None
        self.last_pipeline_start: Optional[datetime] = None
        self.last_pipeline_end: Optional[datetime] = None
        self.last_pipeline_duration_seconds: Optional[float] = None

    def start(self, stage: str = "started"):
        self.running = True
        self.stage = stage
        self.started_at = datetime.now(timezone.utc)
        self.last_pipeline_start = self.started_at

    def update_stage(self, stage: str):
        self.stage = stage

    def end(self, success: bool = True):
        self.running = False
        self.last_pipeline_end = datetime.now(timezone.utc)
        if self.started_at:
            self.last_pipeline_duration_seconds = (self.last_pipeline_end - self.started_at).total_seconds()
        self.stage = "idle" if success else "failed"
        self.started_at = None

pipeline_tracker = PipelineLifecycleTracker()
