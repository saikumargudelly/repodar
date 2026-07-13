"""
Repodar Load Test — Phase 0 & Phase 6 measurement harness.

Usage:
    pip install locust
    locust -f locustfile.py --host=https://repodar-fastapi.duckdns.org \
           --users=20 --spawn-rate=2 --run-time=60s --headless

Run BEFORE any worker count change (baseline).
Run DURING an active pipeline run with different worker configs.
Revert if P95 degrades by >20%.
"""
from locust import HttpUser, task, between


class RepodarUser(HttpUser):
    wait_time = between(1, 3)

    @task(5)
    def dashboard_overview(self):
        with self.client.get("/dashboard/overview", catch_response=True, name="/dashboard/overview") as r:
            if r.status_code != 200:
                r.failure(f"Status {r.status_code}")

    @task(3)
    def leaderboard(self):
        with self.client.get("/dashboard/leaderboard?limit=25", catch_response=True, name="/dashboard/leaderboard") as r:
            if r.status_code != 200:
                r.failure(f"Status {r.status_code}")

    @task(2)
    def list_repos(self):
        with self.client.get("/repos?page=1&per_page=20", catch_response=True, name="/repos") as r:
            if r.status_code != 200:
                r.failure(f"Status {r.status_code}")

    @task(1)
    def early_radar(self):
        with self.client.get("/dashboard/early-radar?min_acceleration=0.1&limit=20", catch_response=True, name="/dashboard/early-radar") as r:
            if r.status_code not in (200, 422):
                r.failure(f"Status {r.status_code}")

    @task(1)
    def health(self):
        with self.client.get("/health", catch_response=True, name="/health") as r:
            if r.status_code != 200:
                r.failure(f"Status {r.status_code}")
