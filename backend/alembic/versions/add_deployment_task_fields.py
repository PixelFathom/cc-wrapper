"""add deployment task fields

Revision ID: add_deployment_task_fields
Revises: fix_issue_resolution_stages
Create Date: 2025-01-27 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_deployment_task_fields'
down_revision = 'fix_issue_resolution_stages'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add deployment task fields to tasks table
    op.add_column('tasks', sa.Column('deployment_port', sa.Integer(), nullable=True))
    op.add_column('tasks', sa.Column('env_file_path', sa.String(), nullable=True))
    op.add_column('tasks', sa.Column('env_variables', postgresql.JSONB(astext_type=sa.Text()), nullable=True))


def downgrade() -> None:
    # Remove deployment task fields from tasks table
    op.drop_column('tasks', 'env_variables')
    op.drop_column('tasks', 'env_file_path')
    op.drop_column('tasks', 'deployment_port')

