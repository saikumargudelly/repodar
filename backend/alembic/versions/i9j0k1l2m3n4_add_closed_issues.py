"""add closed_issues to daily_metrics

Revision ID: i9j0k1l2m3n4
Revises: f6e8ab0e36a7
Create Date: 2026-10-07 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'i9j0k1l2m3n4'
down_revision: Union[str, Sequence[str], None] = 'f6e8ab0e36a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Nullable, no default: historical rows stay NULL (scoring falls back to the legacy proxy).
    op.add_column('daily_metrics', sa.Column('closed_issues', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('daily_metrics', 'closed_issues')
