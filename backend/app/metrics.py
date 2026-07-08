import time
from typing import Dict, List
from collections import defaultdict

class BackendMetrics:
    auth_failures: int = 0
    validation_failures: int = 0
    duplicate_requests: int = 0
    provider_failures: Dict[str, int] = defaultdict(int)
    api_latencies: Dict[str, List[float]] = defaultdict(list)

    @classmethod
    def record_auth_failure(cls):
        cls.auth_failures += 1

    @classmethod
    def record_validation_failure(cls):
        cls.validation_failures += 1

    @classmethod
    def record_duplicate_request(cls):
        cls.duplicate_requests += 1

    @classmethod
    def record_provider_failure(cls, provider: str):
        cls.provider_failures[provider] += 1

    @classmethod
    def record_latency(cls, path: str, latency_ms: float):
        # Keep only the last 100 latencies per path to avoid memory growth
        latencies = cls.api_latencies[path]
        latencies.append(latency_ms)
        if len(latencies) > 100:
            latencies.pop(0)

    @classmethod
    def get_summary(cls) -> dict:
        avg_latencies = {}
        for path, vals in cls.api_latencies.items():
            if vals:
                avg_latencies[path] = sum(vals) / len(vals)
        return {
            "auth_failures": cls.auth_failures,
            "validation_failures": cls.validation_failures,
            "duplicate_requests": cls.duplicate_requests,
            "provider_failures": dict(cls.provider_failures),
            "average_latencies_ms": avg_latencies,
        }
