"""feature pack v4 — summaries, social_mentions, repo_releases, subscribers, weekly_snapshots, commit_activity

Revision ID: g7h8i9j0k1l2
Revises: f6a7b8c9d0e1
Create Date: 2026-03-07 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect, text

revision = "g7h8i9j0k1l2"
down_revision = "f6a7b8c9d0e1"
branch_labels = None
depends_on = None


def _columns(conn, table: str) -> set:
    insp = inspect(conn)
    try:
        return {c["name"] for c in insp.get_columns(table)}
    except Exception:
        return set()


def _tables(conn) -> set:
    insp = inspect(conn)
    return set(insp.get_table_names())


def upgrade() -> None:
    conn = op.get_bind()
    existing_tables = _tables(conn)

    # ── 1. repositories — repo_summary columns ───────────────────────────────
    repo_cols = _columns(conn, "repositories")
    with op.batch_alter_table("repositories", schema=None) as batch_op:
        if "repo_summary" not in repo_cols:
            batch_op.add_column(sa.Column("repo_summary", sa.Text(), nullable=True))
        if "repo_summary_generated_at" not in repo_cols:
            batch_op.add_column(sa.Column("repo_summary_generated_at", sa.DateTime(), nullable=True))
        if "commit_activity_json" not in repo_cols:
            batch_op.add_column(sa.Column("commit_activity_json", sa.Text(), nullable=True))
        if "commit_activity_updated_at" not in repo_cols:
            batch_op.add_column(sa.Column("commit_activity_updated_at", sa.DateTime(), nullable=True))

    # ── 2. social_mentions ───────────────────────────────────────────────────
    if "social_mentions" not in existing_tables:
        op.create_table(
            "social_mentions",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("repo_id", sa.String(36), sa.ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("platform", sa.String(32), nullable=False),   # "hn" | "reddit"
            sa.Column("post_title", sa.Text(), nullable=True),
            sa.Column("post_url", sa.String(512), nullable=False),
            sa.Column("upvotes", sa.Integer(), default=0),
            sa.Column("comment_count", sa.Integer(), default=0),
            sa.Column("subreddit", sa.String(64), nullable=True),
            sa.Column("posted_at", sa.DateTime(), nullable=False),
            sa.Column("fetched_at", sa.DateTime(), nullable=False),
        )
        op.create_index("ix_social_mentions_repo_platform", "social_mentions", ["repo_id", "platform"])

    # ── 3. repo_releases ─────────────────────────────────────────────────────
    if "repo_releases" not in existing_tables:
        op.create_table(
            "repo_releases",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("repo_id", sa.String(36), sa.ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("tag_name", sa.String(128), nullable=False),
            sa.Column("name", sa.Text(), nullable=True),
            sa.Column("body_truncated", sa.Text(), nullable=True),
            sa.Column("published_at", sa.DateTime(), nullable=False),
            sa.Column("is_prerelease", sa.Boolean(), default=False),
            sa.Column("html_url", sa.String(512), nullable=True),
            sa.Column("fetched_at", sa.DateTime(), nullable=False),
        )
        op.create_index("ix_repo_releases_repo_published", "repo_releases", ["repo_id", "published_at"])

    # ── 4. subscribers ────────────────────────────────────────────────────────
    if "subscribers" not in existing_tables:
        op.create_table(
            "subscribers",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("email", sa.String(255), nullable=False, unique=True),
            sa.Column("verticals_json", sa.Text(), nullable=True),   # JSON array of vertical keys
            sa.Column("is_confirmed", sa.Boolean(), default=False),
            sa.Column("confirm_token", sa.String(64), nullable=True, unique=True),
            sa.Column("unsubscribe_token", sa.String(64), nullable=True, unique=True),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("confirmed_at", sa.DateTime(), nullable=True),
        )
        op.create_index("ix_subscribers_email", "subscribers", ["email"], unique=True)
        op.create_index("ix_subscribers_confirm_token", "subscribers", ["confirm_token"])
        op.create_index("ix_subscribers_unsub_token", "subscribers", ["unsubscribe_token"])

    # ── 5. weekly_snapshots ───────────────────────────────────────────────────
    if "weekly_snapshots" not in existing_tables:
        op.create_table(
            "weekly_snapshots",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("week_id", sa.String(16), nullable=False, unique=True),  # e.g. "2026-W10"
            sa.Column("published_at", sa.DateTime(), nullable=False),
            sa.Column("data_json", sa.Text(), nullable=False),   # JSON: top-25 repos
        )
        op.create_index("ix_weekly_snapshots_week_id", "weekly_snapshots", ["week_id"], unique=True)


def downgrade() -> None:
    conn = op.get_bind()
    existing_tables = _tables(conn)

    for tbl in ["weekly_snapshots", "subscribers", "repo_releases", "social_mentions"]:
        if tbl in existing_tables:
            op.drop_table(tbl)

    repo_cols = _columns(conn, "repositories")
    with op.batch_alter_table("repositories", schema=None) as batch_op:
        for col in ["repo_summary", "repo_summary_generated_at", "commit_activity_json", "commit_activity_updated_at"]:
            if col in repo_cols:
                batch_op.drop_column(col)
