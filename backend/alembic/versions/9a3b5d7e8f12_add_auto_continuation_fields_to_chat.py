"""Add auto-continuation fields to chat table

Revision ID: 9a3b5d7e8f12
Revises: 0964621a2058
Create Date: 2025-01-20 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision = '9a3b5d7e8f12'
down_revision = '0964621a2058'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add new columns to the chats table
    op.add_column('chats', sa.Column('continuation_status', sa.String(), nullable=False, server_default='NONE'))
    op.add_column('chats', sa.Column('continuation_count', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('chats', sa.Column('auto_continuation_enabled', sa.Boolean(), nullable=False, server_default='true'))
    op.add_column('chats', sa.Column('parent_message_id', sqlmodel.sql.sqltypes.GUID(), nullable=True))
    
    # Create foreign key constraint for parent_message_id
    op.create_foreign_key(
        'fk_chats_parent_message_id', 
        'chats', 
        'chats', 
        ['parent_message_id'], 
        ['id'],
        ondelete='SET NULL'
    )
    
    # Create index for performance
    op.create_index(op.f('ix_chats_continuation_status'), 'chats', ['continuation_status'], unique=False)
    op.create_index(op.f('ix_chats_parent_message_id'), 'chats', ['parent_message_id'], unique=False)


def downgrade() -> None:
    # Drop indexes
    op.drop_index(op.f('ix_chats_parent_message_id'), table_name='chats')
    op.drop_index(op.f('ix_chats_continuation_status'), table_name='chats')
    
    # Drop foreign key constraint
    op.drop_constraint('fk_chats_parent_message_id', 'chats', type_='foreignkey')
    
    # Drop columns
    op.drop_column('chats', 'parent_message_id')
    op.drop_column('chats', 'auto_continuation_enabled')
    op.drop_column('chats', 'continuation_count')
    op.drop_column('chats', 'continuation_status')