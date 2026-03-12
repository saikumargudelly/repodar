"""add onboarding and alert statistical fields

Revision ID: h8i9j0k1l2m
Revises: g7h8i9j0k1l2
Create Date: 2026-03-11 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision = "h8i9j0k1l2m"
down_revision = "g7h8i9j0k1l2"
branch_labels = None
depends_on = None


def _tables(conn) -> set[str]:
    return set(inspect(conn).get_table_names())


def _columns(conn, table_name: str) -> set[str]:
    insp = inspect(conn)
    try:
        return {col["name"] for col in insp.get_columns(table_name)}
    except Exception:
        return set()


def _indexes(conn, table_name: str) -> set[str]:
    insp = inspect(conn)
    try:
        return {idx["name"] for idx in insp.get_indexes(table_name)}
    except Exception:
        return set()


def upgrade() -> None:
    conn = op.get_bind()
    tables = _tables(conn)

    # 1) trend_alerts: statistical context columns for adaptive spike alerts
    if "trend_alerts" in tables:
        cols = _columns(conn, "trend_alerts")
        with op.batch_alter_table("trend_alerts", schema=None) as batch_op:
            if "baseline_mean" not in cols:
                batch_op.add_column(sa.Column("baseline_mean", sa.Float(), nullable=True))
            if "baseline_stddev" not in cols:
                batch_op.add_column(sa.Column("baseline_stddev", sa.Float(), nullable=True))
            if "z_score" not in cols:
                batch_op.add_column(sa.Column("z_score", sa.Float(), nullable=True))
            if "percentile" not in cols:
                batch_op.add_column(sa.Column("percentile", sa.Float(), nullable=True))
            if "is_sustained" not in cols:
                batch_op.add_column(
                    sa.Column("is_sustained", sa.Boolean(), nullable=False, server_default=sa.false())
                )
            if "momentum_direction" not in cols:
                batch_op.add_column(sa.Column("momentum_direction", sa.String(length=24), nullable=True))

    # 2) subscribers: per-user digest preferences and dispatch bookkeeping
    if "subscribers" in tables:
        cols = _columns(conn, "subscribers")
        idx = _indexes(conn, "subscribers")
        with op.batch_alter_table("subscribers", schema=None) as batch_op:
            if "user_id" not in cols:
                batch_op.add_column(sa.Column("user_id", sa.String(length=128), nullable=True))
            if "email_frequency" not in cols:
                batch_op.add_column(
                    sa.Column("email_frequency", sa.String(length=24), nullable=False, server_default="weekly")
                )
            if "last_digest_sent_at" not in cols:
                batch_op.add_column(sa.Column("last_digest_sent_at", sa.DateTime(), nullable=True))

        # unique/index handling outside batch for broader dialect compatibility
        if "ix_subscribers_user_id" not in idx:
            op.create_index("ix_subscribers_user_id", "subscribers", ["user_id"], unique=True)

    # 3) user_onboarding: first-run setup state machine
    if "user_onboarding" not in tables:
        op.create_table(
            "user_onboarding",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("user_id", sa.String(length=128), nullable=False),
            sa.Column("selected_verticals_json", sa.Text(), nullable=False, server_default="[]"),
            sa.Column("current_step", sa.String(length=24), nullable=False, server_default="interests"),
            sa.Column("interests_completed", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("watchlist_completed", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("alerts_completed", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("tour_completed", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("onboarding_completed", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.Column("completed_at", sa.DateTime(), nullable=True),
            sa.Column("skipped_at", sa.DateTime(), nullable=True),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_user_onboarding_user_id", "user_onboarding", ["user_id"], unique=True)


def downgrade() -> None:
    conn = op.get_bind()
    tables = _tables(conn)

    if "user_onboarding" in tables:
        op.drop_index("ix_user_onboarding_user_id", table_name="user_onboarding")
        op.drop_table("user_onboarding")

    if "subscribers" in tables:
        idx = _indexes(conn, "subscribers")
        if "ix_subscribers_user_id" in idx:
            op.drop_index("ix_subscribers_user_id", table_name="subscribers")

        cols = _columns(conn, "subscribers")
        with op.batch_alter_table("subscribers", schema=None) as batch_op:
            if "last_digest_sent_at" in cols:
                batch_op.drop_column("last_digest_sent_at")
            if "email_frequency" in cols:
                batch_op.drop_column("email_frequency")
            if "user_id" in cols:
                batch_op.drop_column("user_id")

    if "trend_alerts" in tables:
        cols = _columns(conn, "trend_alerts")
        with op.batch_alter_table("trend_alerts", schema=None) as batch_op:
            if "momentum_direction" in cols:
                batch_op.drop_column("momentum_direction")
            if "is_sustained" in cols:
                batch_op.drop_column("is_sustained")
            if "percentile" in cols:
                batch_op.drop_column("percentile")
            if "z_score" in cols:
                batch_op.drop_column("z_score")
            if "baseline_stddev" in cols:
                batch_op.drop_column("baseline_stddev")
            if "baseline_mean" in cols:
                batch_op.drop_column("baseline_mean")
