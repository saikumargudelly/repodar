"""
a2a_service_catalog:
  New tables for Agent-to-Agent (A2A) service discovery and indexing:
    - a2a_services     — registered AI services with /a2a-card endpoints
    - a2a_capabilities — individual capabilities exposed by each service
"""

import sqlalchemy as sa
from alembic import op

revision = "e5f6a7b8c9d0"
down_revision = "d4e5f6a7b8c9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "a2a_services",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("provider", sa.String(255), nullable=True),
        sa.Column("base_url", sa.String(512), nullable=False, unique=True),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("version", sa.String(64), nullable=True),
        sa.Column("categories", sa.Text, nullable=True),
        sa.Column("status", sa.String(32), nullable=False, server_default="active"),
        sa.Column("response_latency_ms", sa.Integer, nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=False),
        sa.Column("last_checked_at", sa.DateTime, nullable=True),
        sa.Column("last_seen_at", sa.DateTime, nullable=True),
    )
    op.create_index("ix_a2a_services_id", "a2a_services", ["id"])
    op.create_index("ix_a2a_services_base_url", "a2a_services", ["base_url"], unique=True)
    op.create_index("ix_a2a_services_status", "a2a_services", ["status"])
    op.create_index("ix_a2a_services_status_last_seen", "a2a_services", ["status", "last_seen_at"])

    op.create_table(
        "a2a_capabilities",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "service_id",
            sa.String(36),
            sa.ForeignKey("a2a_services.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("method", sa.String(16), nullable=False, server_default="GET"),
        sa.Column("path", sa.String(512), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
    )
    op.create_index("ix_a2a_capabilities_id", "a2a_capabilities", ["id"])
    op.create_index("ix_a2a_capabilities_service_id", "a2a_capabilities", ["service_id"])


def downgrade() -> None:
    op.drop_table("a2a_capabilities")
    op.drop_table("a2a_services")
