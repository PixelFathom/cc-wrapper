"""Add parent_session_id to chats table for task breakdown

Revision ID: add_parent_session_id
Revises: fix_issue_resolution_stages
Create Date: 2025-11-26 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_parent_session_id'
down_revision = 'fix_issue_resolution_stages'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add parent_session_id column (nullable initially for backfill)
    op.add_column('chats', sa.Column('parent_session_id', sa.String(), nullable=True))
    
    # Backfill existing records with self-reference (parent_session_id = session_id)
    op.execute("""
        UPDATE chats 
        SET parent_session_id = session_id 
        WHERE parent_session_id IS NULL
    """)
    
    # Create index for efficient grouping queries
    op.create_index(op.f('ix_chats_parent_session_id'), 'chats', ['parent_session_id'], unique=False)


def downgrade() -> None:
    # Drop index
    op.drop_index(op.f('ix_chats_parent_session_id'), table_name='chats')
    
    # Drop column
    op.drop_column('chats', 'parent_session_id')

