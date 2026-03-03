from app.routers.repositories import router as repos_router
from app.routers.metrics import router as metrics_router
from app.routers.dashboard import router as dashboard_router
from app.routers.reports import router as reports_router
from app.routers.admin import router as admin_router
from app.routers.widgets import router as widgets_router
from app.routers.orgs import router as orgs_router

__all__ = [
    "repos_router", "metrics_router", "dashboard_router",
    "reports_router", "admin_router", "widgets_router", "orgs_router",
]
