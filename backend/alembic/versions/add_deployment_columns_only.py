"""add deployment columns to tasks only

Revision ID: add_deployment_columns_only
Revises: add_deployment_fields
Create Date: 2025-07-18 19:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'add_deployment_columns_only'
down_revision = 'add_deployment_fields'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add deployment fields to tasks table only
    op.add_column('tasks', sa.Column('deployment_status', sa.String(), nullable=False, server_default='pending'))
    op.add_column('tasks', sa.Column('deployment_request_id', sa.String(), nullable=True))
    op.add_column('tasks', sa.Column('deployment_completed', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('tasks', sa.Column('deployment_started_at', sa.DateTime(), nullable=True))
    op.add_column('tasks', sa.Column('deployment_completed_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    # Remove deployment fields from tasks table
    op.drop_column('tasks', 'deployment_completed_at')
    op.drop_column('tasks', 'deployment_started_at')
    op.drop_column('tasks', 'deployment_completed')
    op.drop_column('tasks', 'deployment_request_id')
    op.drop_column('tasks', 'deployment_status')