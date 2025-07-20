"""Add new webhook fields to chat_hooks table

Revision ID: add_new_webhook_fields
Revises: 8002f2c420d0
Create Date: 2025-01-19

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_new_webhook_fields'
down_revision = '8002f2c420d0'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add new columns to chat_hooks table
    op.add_column('chat_hooks', sa.Column('conversation_id', sa.String(), nullable=True))
    op.add_column('chat_hooks', sa.Column('message_type', sa.String(), nullable=True))
    op.add_column('chat_hooks', sa.Column('content_type', sa.String(), nullable=True))
    op.add_column('chat_hooks', sa.Column('tool_name', sa.String(), nullable=True))
    op.add_column('chat_hooks', sa.Column('tool_input', postgresql.JSON(astext_type=sa.Text()), nullable=True))
    
    # Create index on conversation_id for faster queries
    op.create_index(op.f('ix_chat_hooks_conversation_id'), 'chat_hooks', ['conversation_id'], unique=False)
    
    # Create index on data->>'task_id' for efficient task_id queries
    op.create_index('ix_chat_hooks_task_id', 'chat_hooks', [sa.text("(data->>'task_id')")], unique=False)


def downgrade() -> None:
    # Remove indexes
    op.drop_index('ix_chat_hooks_task_id', table_name='chat_hooks')
    op.drop_index(op.f('ix_chat_hooks_conversation_id'), table_name='chat_hooks')
    
    # Remove columns
    op.drop_column('chat_hooks', 'tool_input')
    op.drop_column('chat_hooks', 'tool_name')
    op.drop_column('chat_hooks', 'content_type')
    op.drop_column('chat_hooks', 'message_type')
    op.drop_column('chat_hooks', 'conversation_id')