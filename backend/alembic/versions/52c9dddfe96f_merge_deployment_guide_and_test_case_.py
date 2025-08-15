"""Merge deployment guide and test case migrations

Revision ID: 52c9dddfe96f
Revises: 3d94ae6e73b3, add_deployment_guide
Create Date: 2025-08-14 22:22:18.933919

"""
from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision = '52c9dddfe96f'
down_revision = ('3d94ae6e73b3', 'add_deployment_guide')
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass