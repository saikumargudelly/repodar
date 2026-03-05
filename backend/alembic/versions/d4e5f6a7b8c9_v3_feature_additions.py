"""
v3 feature additions:
  repositories
    - topics            TEXT nullable        — JSON array of GitHub topic tags
    - stars_snapshot    INTEGER default 0    — latest star count (denormalised)
  
  New tables:
    - watchlist_items   — per-user repo subscriptions tied to Clerk user_id
    - api_keys          — hashed API keys for programmatic access
    - repo_contributors — top contributors per repo (cross-repo network)
    - fork_snapshots    — notable forks tracking
    - ecosystem_reports — persisted weekly/monthly generated reports
"""

import sqlalchemy as sa
from alembic import op

revision = "d4e5f6a7b8c9"
down_revision = "c2d3e4f5a6b7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # ── 1. repositories: new columns ─────────────────────────────────────────
    repo_cols = {c["name"] for c in sa.inspect(conn).get_columns("repositories")}
    with op.batch_alter_table("repositories") as batch_op:
        if "topics" not in repo_cols:
            batch_op.add_column(sa.Column("topics", sa.Text(), nullable=True))
        if "stars_snapshot" not in repo_cols:
            batch_op.add_column(
                sa.Column("stars_snapshot", sa.Integer(), nullable=False, server_default="0")
            )

    # ── 2. watchlist_items ────────────────────────────────────────────────────
    existing_tables = sa.inspect(conn).get_table_names()

    if "watchlist_items" not in existing_tables:
        op.create_table(
            "watchlist_items",
            sa.Column("id",              sa.String(36),  primary_key=True),
            sa.Column("user_id",         sa.String(128), nullable=False),
            sa.Column("repo_id",         sa.String(36),  nullable=False),
            sa.Column("created_at",      sa.DateTime(),  nullable=True),
            sa.Column("alert_threshold", sa.Float(),     nullable=True),
            sa.Column("notify_email",    sa.String(255), nullable=True),
            sa.Column("notify_webhook",  sa.Text(),      nullable=True),
            sa.ForeignKeyConstraint(["repo_id"], ["repositories.id"], ondelete="CASCADE"),
        )
        op.create_index("ix_watchlist_user_id",  "watchlist_items", ["user_id"])
        op.create_index("ix_watchlist_repo_id",  "watchlist_items", ["repo_id"])
        op.create_unique_constraint("uq_watchlist_user_repo", "watchlist_items",
                                    ["user_id", "repo_id"])

    # ── 3. api_keys ───────────────────────────────────────────────────────────
    if "api_keys" not in existing_tables:
        op.create_table(
            "api_keys",
            sa.Column("id",                  sa.String(36),  primary_key=True),
            sa.Column("key_hash",            sa.String(64),  nullable=False),
            sa.Column("user_id",             sa.String(128), nullable=True),
            sa.Column("name",                sa.String(255), nullable=False, server_default="My API Key"),
            sa.Column("tier",                sa.String(32),  nullable=False, server_default="free"),
            sa.Column("calls_today",         sa.Integer(),   nullable=False, server_default="0"),
            sa.Column("calls_this_month",    sa.Integer(),   nullable=False, server_default="0"),
            sa.Column("calls_total",         sa.Integer(),   nullable=False, server_default="0"),
            sa.Column("calls_day_reset_at",  sa.DateTime(),  nullable=True),
            sa.Column("created_at",          sa.DateTime(),  nullable=True),
            sa.Column("last_used_at",        sa.DateTime(),  nullable=True),
            sa.Column("is_active",           sa.Boolean(),   nullable=False, server_default="true"),
        )
        op.create_unique_constraint("uq_api_keys_hash", "api_keys", ["key_hash"])
        op.create_index("ix_api_keys_hash",    "api_keys", ["key_hash"])
        op.create_index("ix_api_keys_user_id", "api_keys", ["user_id"])

    # ── 4. repo_contributors ──────────────────────────────────────────────────
    if "repo_contributors" not in existing_tables:
        op.create_table(
            "repo_contributors",
            sa.Column("id",            sa.String(36),  primary_key=True),
            sa.Column("repo_id",       sa.String(36),  nullable=False),
            sa.Column("login",         sa.String(255), nullable=False),
            sa.Column("avatar_url",    sa.String(512), nullable=True),
            sa.Column("contributions", sa.Integer(),   nullable=False, server_default="0"),
            sa.Column("updated_at",    sa.DateTime(),  nullable=True),
            sa.ForeignKeyConstraint(["repo_id"], ["repositories.id"], ondelete="CASCADE"),
        )
        op.create_index("ix_rc_repo_id", "repo_contributors", ["repo_id"])
        op.create_index("ix_rc_login",   "repo_contributors", ["login"])
        op.create_unique_constraint("uq_repo_contributor", "repo_contributors",
                                    ["repo_id", "login"])

    # ── 5. fork_snapshots ─────────────────────────────────────────────────────
    if "fork_snapshots" not in existing_tables:
        op.create_table(
            "fork_snapshots",
            sa.Column("id",               sa.String(36),  primary_key=True),
            sa.Column("parent_repo_id",   sa.String(36),  nullable=False),
            sa.Column("fork_owner",       sa.String(255), nullable=False),
            sa.Column("fork_name",        sa.String(255), nullable=False),
            sa.Column("fork_full_name",   sa.String(512), nullable=False),
            sa.Column("github_url",       sa.String(512), nullable=False),
            sa.Column("stars",            sa.Integer(),   nullable=False, server_default="0"),
            sa.Column("forks",            sa.Integer(),   nullable=False, server_default="0"),
            sa.Column("open_issues",      sa.Integer(),   nullable=False, server_default="0"),
            sa.Column("primary_language", sa.String(100), nullable=True),
            sa.Column("last_push_at",     sa.DateTime(),  nullable=True),
            sa.Column("is_diverged",      sa.Boolean(),   nullable=False, server_default="false"),
            sa.Column("snapshot_date",    sa.Date(),      nullable=False),
            sa.Column("captured_at",      sa.DateTime(),  nullable=True),
            sa.ForeignKeyConstraint(["parent_repo_id"], ["repositories.id"], ondelete="CASCADE"),
        )
        op.create_index("ix_fs_parent_repo_id",  "fork_snapshots", ["parent_repo_id"])
        op.create_index("ix_fs_snapshot_date",   "fork_snapshots", ["snapshot_date"])
        op.create_unique_constraint("uq_fork_snapshot_daily", "fork_snapshots",
                                    ["parent_repo_id", "fork_full_name", "snapshot_date"])

    # ── 6. ecosystem_reports ──────────────────────────────────────────────────
    if "ecosystem_reports" not in existing_tables:
        op.create_table(
            "ecosystem_reports",
            sa.Column("id",           sa.String(36),  primary_key=True),
            sa.Column("period_type",  sa.String(20),  nullable=False),
            sa.Column("period_label", sa.String(30),  nullable=False),
            sa.Column("generated_at", sa.DateTime(),  nullable=True),
            sa.Column("report_json",  sa.Text(),      nullable=False),
        )
        op.create_index("ix_er_period_type",   "ecosystem_reports", ["period_type"])
        op.create_index("ix_er_generated_at",  "ecosystem_reports", ["generated_at"])
        op.create_unique_constraint("uq_report_period", "ecosystem_reports",
                                    ["period_type", "period_label"])


def downgrade() -> None:
    op.drop_table("ecosystem_reports")
    op.drop_table("fork_snapshots")
    op.drop_table("repo_contributors")
    op.drop_table("api_keys")
    op.drop_table("watchlist_items")
    with op.batch_alter_table("repositories") as batch_op:
        batch_op.drop_column("stars_snapshot")
        batch_op.drop_column("topics")
