"""Fix continuation status enum values

Revision ID: fix_continuation_status_enum
Revises: 9a3b5d7e8f12
Create Date: 2025-01-20 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'fix_continuation_status_enum'
down_revision = '9a3b5d7e8f12'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # This migration is now a no-op since we're using strings instead of enums
    # Kept for migration history consistency
    pass


def downgrade() -> None:
    # This migration is now a no-op since we're using strings instead of enums
    # Kept for migration history consistency
    pass