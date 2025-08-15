"""merge heads

Revision ID: 3d94ae6e73b3
Revises: 4e5f9d2a8b3c, fix_continuation_status_enum
Create Date: 2025-08-13 04:07:40.463413

"""
from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision = '3d94ae6e73b3'
down_revision = ('4e5f9d2a8b3c', 'fix_continuation_status_enum')
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass