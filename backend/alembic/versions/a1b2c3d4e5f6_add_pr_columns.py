"""add open_prs and daily_pr_delta columns

Revision ID: a1b2c3d4e5f6
Revises: 8feacc6313a1
Create Date: 2026-03-04 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '8feacc6313a1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('daily_metrics', sa.Column('open_prs', sa.Integer(), nullable=True, server_default='0'))
    op.add_column('daily_metrics', sa.Column('daily_pr_delta', sa.Integer(), nullable=True, server_default='0'))


def downgrade() -> None:
    op.drop_column('daily_metrics', 'daily_pr_delta')
    op.drop_column('daily_metrics', 'open_prs')
