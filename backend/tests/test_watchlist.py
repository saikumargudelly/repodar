import pytest
from fastapi import HTTPException
from app.models import Repository
from app.models.watchlist import WatchlistItem
from app.routers.watchlist import check_watchlist, add_to_watchlist, WatchlistItemCreate
from tests.conftest import make_repo

def test_check_watchlist_by_uuid(db_session):
    # Setup repo and watch item
    repo = make_repo(db_session, owner="owner", name="repo")
    item = WatchlistItem(
        user_id="test-user",
        repo_id=repo.id,
        alert_threshold=0.1,
    )
    db_session.add(item)
    db_session.commit()

    # Test checking by UUID
    res = check_watchlist(repo_id=repo.id, user_id="test-user", db=db_session)
    assert res.watching is True
    assert res.item.repo_id == repo.id

    # Test checking non-existent / unwatched UUID
    res_unwatched = check_watchlist(repo_id="00000000-0000-0000-0000-000000000000", user_id="test-user", db=db_session)
    assert res_unwatched.watching is False
    assert res_unwatched.item is None

def test_check_watchlist_by_slug(db_session):
    # Setup repo and watch item
    repo = make_repo(db_session, owner="facebook", name="react")
    item = WatchlistItem(
        user_id="test-user",
        repo_id=repo.id,
        alert_threshold=0.1,
    )
    db_session.add(item)
    db_session.commit()

    # Test checking by owner/repo slug (case-insensitive)
    res = check_watchlist(repo_id="facebook/react", user_id="test-user", db=db_session)
    assert res.watching is True
    assert res.item.repo_id == repo.id

    res_case = check_watchlist(repo_id="FACEBOOK/React", user_id="test-user", db=db_session)
    assert res_case.watching is True

    # Test checking non-existent/unwatched slug
    res_unwatched = check_watchlist(repo_id="facebook/flux", user_id="test-user", db=db_session)
    assert res_unwatched.watching is False
    assert res_unwatched.item is None

def test_add_to_watchlist_by_slug(db_session):
    repo = make_repo(db_session, owner="google", name="jax")
    
    # Add via slug
    body = WatchlistItemCreate(repo_id="google/jax", alert_threshold=0.2)
    res = add_to_watchlist(body=body, user_id="test-user", db=db_session)
    assert res.repo_id == repo.id

    # Try to add a non-existent repo by slug (should raise 404)
    body_fail = WatchlistItemCreate(repo_id="google/nonexistent", alert_threshold=0.2)
    with pytest.raises(HTTPException) as excinfo:
        add_to_watchlist(body=body_fail, user_id="test-user", db=db_session)
    assert excinfo.value.status_code == 404
