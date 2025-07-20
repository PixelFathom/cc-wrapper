"""add deployment fields to tasks

Revision ID: add_deployment_fields
Revises: 
Create Date: 2025-07-18 18:40:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_deployment_fields'
down_revision = '001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add deployment fields to tasks table
    op.add_column('tasks', sa.Column('deployment_status', sa.String(), nullable=False, server_default='pending'))
    op.add_column('tasks', sa.Column('deployment_request_id', sa.String(), nullable=True))
    op.add_column('tasks', sa.Column('deployment_completed', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('tasks', sa.Column('deployment_started_at', sa.DateTime(), nullable=True))
    op.add_column('tasks', sa.Column('deployment_completed_at', sa.DateTime(), nullable=True))
    
    # Create deployment_hooks table
    op.create_table('deployment_hooks',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('task_id', sa.Uuid(), nullable=False),
        sa.Column('session_id', sa.String(), nullable=False),
        sa.Column('hook_type', sa.String(), nullable=False),
        sa.Column('status', sa.String(), nullable=False),
        sa.Column('data', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('message', sa.String(), nullable=True),
        sa.Column('is_complete', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('received_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['task_id'], ['tasks.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_deployment_hooks_session_id'), 'deployment_hooks', ['session_id'], unique=False)
    op.create_index(op.f('ix_deployment_hooks_task_id'), 'deployment_hooks', ['task_id'], unique=False)


def downgrade() -> None:
    # Drop deployment_hooks table
    op.drop_index(op.f('ix_deployment_hooks_task_id'), table_name='deployment_hooks')
    op.drop_index(op.f('ix_deployment_hooks_session_id'), table_name='deployment_hooks')
    op.drop_table('deployment_hooks')
    
    # Remove deployment fields from tasks table
    op.drop_column('tasks', 'deployment_completed_at')
    op.drop_column('tasks', 'deployment_started_at')
    op.drop_column('tasks', 'deployment_completed')
    op.drop_column('tasks', 'deployment_request_id')
    op.drop_column('tasks', 'deployment_status')