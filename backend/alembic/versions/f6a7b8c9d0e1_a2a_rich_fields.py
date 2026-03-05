"""a2a rich metadata fields

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2025-01-01 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "f6a7b8c9d0e1"
down_revision = "e5f6a7b8c9d0"
branch_labels = None
depends_on = None

_NEW_COLUMNS = [
    ("auth_schemes",      sa.Text(),         True),
    ("input_modes",       sa.Text(),         True),
    ("output_modes",      sa.Text(),         True),
    ("documentation_url", sa.String(512),    True),
    ("supports_streaming",sa.Integer(),      True),
]


def _existing_columns(conn, table: str) -> set[str]:
    insp = inspect(conn)
    return {c["name"] for c in insp.get_columns(table)}


def upgrade() -> None:
    conn = op.get_bind()
    existing = _existing_columns(conn, "a2a_services")

    with op.batch_alter_table("a2a_services", schema=None) as batch_op:
        for col_name, col_type, nullable in _NEW_COLUMNS:
            if col_name not in existing:
                batch_op.add_column(sa.Column(col_name, col_type, nullable=nullable))


def downgrade() -> None:
    conn = op.get_bind()
    existing = _existing_columns(conn, "a2a_services")

    with op.batch_alter_table("a2a_services", schema=None) as batch_op:
        for col_name, _, _ in _NEW_COLUMNS:
            if col_name in existing:
                batch_op.drop_column(col_name)
