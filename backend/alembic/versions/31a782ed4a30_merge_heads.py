"""merge_heads

Revision ID: 31a782ed4a30
Revises: 844368e6b670, add_parent_session_id
Create Date: 2025-11-26 22:13:16.008401

"""
from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision = '31a782ed4a30'
down_revision = ('844368e6b670', 'add_parent_session_id')
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass