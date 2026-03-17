from app.routers.repositories import router as repos_router
from app.routers.metrics import router as metrics_router
from app.routers.dashboard import router as dashboard_router
from app.routers.reports import router as reports_router
from app.routers.admin import router as admin_router
from app.routers.widgets import router as widgets_router
from app.routers.orgs import router as orgs_router
from app.routers.watchlist import router as watchlist_router
from app.routers.topics import router as topics_router
from app.routers.contributors import router as contributors_router
from app.routers.forks import router as forks_router
from app.routers.apikeys import router as apikeys_router
from app.routers.services import router as services_router
from app.routers.feed import router as feed_router
from app.routers.subscribe import router as subscribe_router
from app.routers.search import router as search_router
from app.routers.snapshots import router as snapshots_router
from app.routers.onboarding import router as onboarding_router
from app.routers.profile import router as profile_router
from app.routers.research import router as research_router
from app.routers.filters import router as filters_router
from app.routers.forecast import router as forecast_router
from app.routers.export import router as export_router
from app.routers.recommendations import router as recommendations_router
from app.routers.webhooks import router as webhooks_router
from app.routers.collections import router as collections_router

__all__ = [
    "repos_router", "metrics_router", "dashboard_router",
    "reports_router", "admin_router", "widgets_router", "orgs_router",
    "watchlist_router", "topics_router", "contributors_router",
    "forks_router",    "apikeys_router", "services_router", "feed_router",
    "subscribe_router", "search_router", "snapshots_router",
    "onboarding_router", "profile_router", "research_router",
    "filters_router", "forecast_router", "export_router",
    "recommendations_router", "webhooks_router", "collections_router",
]
