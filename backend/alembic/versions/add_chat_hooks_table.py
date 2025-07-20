"""add chat hooks table

Revision ID: add_chat_hooks_table
Revises: add_deployment_columns_only
Create Date: 2025-07-18 19:30:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_chat_hooks_table'
down_revision = 'add_deployment_columns_only'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create chat_hooks table
    op.create_table('chat_hooks',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('chat_id', sa.Uuid(), nullable=False),
        sa.Column('session_id', sa.String(), nullable=False),
        sa.Column('hook_type', sa.String(), nullable=False),
        sa.Column('status', sa.String(), nullable=False),
        sa.Column('data', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('message', sa.String(), nullable=True),
        sa.Column('is_complete', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('received_at', sa.DateTime(), nullable=False),
        sa.Column('step_name', sa.String(), nullable=True),
        sa.Column('step_index', sa.Integer(), nullable=True),
        sa.Column('total_steps', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['chat_id'], ['chats.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_chat_hooks_chat_id'), 'chat_hooks', ['chat_id'], unique=False)
    op.create_index(op.f('ix_chat_hooks_session_id'), 'chat_hooks', ['session_id'], unique=False)


def downgrade() -> None:
    # Drop chat_hooks table
    op.drop_index(op.f('ix_chat_hooks_session_id'), table_name='chat_hooks')
    op.drop_index(op.f('ix_chat_hooks_chat_id'), table_name='chat_hooks')
    op.drop_table('chat_hooks')