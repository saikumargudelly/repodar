"""
Auto-discovery fields on repositories:
  - is_active             : bool, default True  — inactive repos are skipped in
                            daily ingestion but retain all historical data.
  - source                : str, default "seed" — "seed" | "auto_discovered"
  - discovered_at         : datetime nullable    — when auto-added to the DB
  - last_seen_trending    : datetime nullable    — last time seen in any
                            trending/search result; drives deactivation logic
"""

import sqlalchemy as sa
from alembic import op

revision = "c2d3e4f5a6b7"
down_revision = "b9c1d2e3f4a5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    existing_cols = {c["name"] for c in sa.inspect(conn).get_columns("repositories")}

    with op.batch_alter_table("repositories") as batch_op:
        if "is_active" not in existing_cols:
            batch_op.add_column(
                sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true")
            )
        if "source" not in existing_cols:
            batch_op.add_column(
                sa.Column("source", sa.String(50), nullable=False, server_default="seed")
            )
        if "discovered_at" not in existing_cols:
            batch_op.add_column(
                sa.Column("discovered_at", sa.DateTime(), nullable=True)
            )
        if "last_seen_trending" not in existing_cols:
            batch_op.add_column(
                sa.Column("last_seen_trending", sa.DateTime(), nullable=True)
            )

    # All existing rows are from the seed YAML — mark them explicitly
    conn.execute(
        sa.text("UPDATE repositories SET source = 'seed', is_active = true WHERE source IS NULL OR source = ''")
    )


def downgrade() -> None:
    with op.batch_alter_table("repositories") as batch_op:
        batch_op.drop_column("last_seen_trending")
        batch_op.drop_column("discovered_at")
        batch_op.drop_column("source")
        batch_op.drop_column("is_active")
