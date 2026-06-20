from fastapi.testclient import TestClient
import os
import pytest

from app.main import app
from app.database import engine

def test_db_pool_status_unauthorized():
    client = TestClient(app)
    resp = client.get("/admin/db-pool-status")
    assert resp.status_code == 403

def test_db_pool_status_authorized(monkeypatch):
    monkeypatch.setenv("ADMIN_SECRET_KEY", "testsecret")
    client = TestClient(app)
    resp = client.get("/admin/db-pool-status", headers={"X-Admin-Key": "testsecret"})
    assert resp.status_code == 200
    data = resp.json()
    assert "pool_type" in data
    assert "checked_out" in data
    assert "pool_size" in data
    assert "overflow" in data
    assert "active_details" in data
