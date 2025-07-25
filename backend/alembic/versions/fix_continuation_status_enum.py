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
    # First, create a new enum type with correct values
    continuationstatus_enum = postgresql.ENUM('none', 'needed', 'in_progress', 'completed', name='continuationstatus_v2')
    continuationstatus_enum.create(op.get_bind())
    
    # Change the column to use the new enum
    op.execute('ALTER TABLE chats ALTER COLUMN continuation_status TYPE continuationstatus_v2 USING continuation_status::text::continuationstatus_v2')
    
    # Drop the old enum type if it exists
    op.execute('DROP TYPE IF EXISTS continuationstatus')
    
    # Rename the new enum to the original name
    op.execute('ALTER TYPE continuationstatus_v2 RENAME TO continuationstatus')


def downgrade() -> None:
    # Create old enum type
    old_enum = postgresql.ENUM('NONE', 'NEEDED', 'IN_PROGRESS', 'COMPLETED', name='continuationstatus_old')
    old_enum.create(op.get_bind())
    
    # Change the column back
    op.execute('ALTER TABLE chats ALTER COLUMN continuation_status TYPE continuationstatus_old USING continuation_status::text::continuationstatus_old')
    
    # Drop current enum
    op.execute('DROP TYPE IF EXISTS continuationstatus')
    
    # Rename old enum back
    op.execute('ALTER TYPE continuationstatus_old RENAME TO continuationstatus')