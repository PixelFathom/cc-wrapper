"""add_chat_id_to_issue_resolution

Revision ID: add_chat_id_issue_res
Revises: b8f90f39d891
Create Date: 2025-01-15 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_chat_id_issue_res'
down_revision = 'b8f90f39d891'
branch_labels = None
depends_on = None


def upgrade():
    # Add chat_id column to issue_resolutions table
    op.add_column('issue_resolutions',
        sa.Column('chat_id', postgresql.UUID(as_uuid=True), nullable=True)
    )

    # Add foreign key constraint
    op.create_foreign_key(
        'fk_issue_resolutions_chat_id_chats',
        'issue_resolutions', 'chats',
        ['chat_id'], ['id'],
        ondelete='SET NULL'
    )

    # Add index for better query performance
    op.create_index(
        'ix_issue_resolutions_chat_id',
        'issue_resolutions',
        ['chat_id'],
        unique=False
    )


def downgrade():
    # Remove index
    op.drop_index('ix_issue_resolutions_chat_id', table_name='issue_resolutions')

    # Remove foreign key
    op.drop_constraint('fk_issue_resolutions_chat_id_chats', 'issue_resolutions', type_='foreignkey')

    # Remove column
    op.drop_column('issue_resolutions', 'chat_id')
