"""
v2 scalability upgrades:
  - repositories.last_fetched_at  — incremental-fetch cursor
  - daily_metrics.commit_count    — total commits on default branch
  - daily_metrics.daily_commit_delta — commits added since last snapshot
  - trend_alerts table            — momentum / star-spike alert rows
  - category_metrics_daily table  — pre-aggregated category cache
"""

from datetime import datetime
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import sqlite

revision = "b9c1d2e3f4a5"
down_revision = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── 1. repositories: incremental-fetch cursor ─────────────────────────
    conn = op.get_bind()
    existing_repo_cols = {c["name"] for c in sa.inspect(conn).get_columns("repositories")}
    if "last_fetched_at" not in existing_repo_cols:
        with op.batch_alter_table("repositories") as batch_op:
            batch_op.add_column(
                sa.Column("last_fetched_at", sa.DateTime(), nullable=True)
            )

    # ── 2. daily_metrics: commit tracking columns ─────────────────────────
    existing_dm_cols = {c["name"] for c in sa.inspect(conn).get_columns("daily_metrics")}
    with op.batch_alter_table("daily_metrics") as batch_op:
        if "commit_count" not in existing_dm_cols:
            batch_op.add_column(sa.Column("commit_count", sa.Integer(), nullable=False, server_default="0"))
        if "daily_commit_delta" not in existing_dm_cols:
            batch_op.add_column(sa.Column("daily_commit_delta", sa.Integer(), nullable=False, server_default="0"))

    # ── 3. trend_alerts table ─────────────────────────────────────────────
    existing_tables = sa.inspect(conn).get_table_names()

    if "trend_alerts" not in existing_tables:
        op.create_table(
            "trend_alerts",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column(
                "repo_id", sa.String(36),
                sa.ForeignKey("repositories.id", ondelete="CASCADE"),
                nullable=False, index=True,
            ),
            sa.Column("alert_type", sa.String(50), nullable=False, index=True),
            sa.Column("window_days", sa.Integer(), nullable=False, server_default="1"),
            sa.Column("headline", sa.String(512), nullable=False),
            sa.Column("metric_value", sa.Float(), server_default="0"),
            sa.Column("threshold", sa.Float(), server_default="0"),
            sa.Column("triggered_at", sa.DateTime(), nullable=False),
            sa.Column("is_read", sa.Boolean(), server_default="0", nullable=False),
            sa.Column("extra_json", sa.Text(), nullable=True),
        )
        op.create_index(
            "ix_trend_alerts_triggered_read",
            "trend_alerts", ["triggered_at", "is_read"],
        )

    # ── 4. category_metrics_daily table ───────────────────────────────────
    if "category_metrics_daily" not in existing_tables:
        op.create_table(
            "category_metrics_daily",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("date", sa.Date(), nullable=False, index=True),
            sa.Column("category", sa.String(100), nullable=False, index=True),
            sa.Column("period_days", sa.Integer(), nullable=False, server_default="7"),
            sa.Column("total_stars", sa.Integer(), server_default="0"),
            sa.Column("total_contributors", sa.Integer(), server_default="0"),
            sa.Column("total_merged_prs", sa.Integer(), server_default="0"),
            sa.Column("repo_count", sa.Integer(), server_default="0"),
            sa.Column("period_star_gain", sa.Integer(), server_default="0"),
            sa.Column("period_pr_gain", sa.Integer(), server_default="0"),
            sa.Column("avg_open_prs", sa.Float(), server_default="0"),
            sa.Column("weekly_velocity", sa.Float(), server_default="0"),
            sa.Column("mom_growth_pct", sa.Float(), server_default="0"),
            sa.Column("trend_composite", sa.Float(), server_default="0"),
            sa.Column("computed_at", sa.DateTime(), nullable=False),
            sa.UniqueConstraint("date", "category", "period_days", name="uq_category_metrics_date_cat_period"),
        )
        op.create_index(
            "ix_category_metrics_date_period",
            "category_metrics_daily", ["date", "period_days"],
        )


def downgrade() -> None:
    op.drop_index("ix_category_metrics_date_period", "category_metrics_daily")
    op.drop_table("category_metrics_daily")

    op.drop_index("ix_trend_alerts_triggered_read", "trend_alerts")
    op.drop_table("trend_alerts")

    with op.batch_alter_table("daily_metrics") as batch_op:
        batch_op.drop_column("daily_commit_delta")
        batch_op.drop_column("commit_count")

    with op.batch_alter_table("repositories") as batch_op:
        batch_op.drop_column("last_fetched_at")
