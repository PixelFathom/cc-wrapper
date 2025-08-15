"""Add deployment guide fields to tasks table

Revision ID: add_deployment_guide
Revises: 3d94ae6e73b3
Create Date: 2024-01-10 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from datetime import datetime

# revision identifiers, used by Alembic.
revision = 'add_deployment_guide'
down_revision = 'add_test_case_hooks_table'
branch_labels = None
depends_on = None


def upgrade():
    # Add deployment guide fields to tasks table
    op.add_column('tasks', sa.Column('deployment_guide', sa.Text(), nullable=True))
    op.add_column('tasks', sa.Column('deployment_guide_updated_at', sa.DateTime(), nullable=True))


def downgrade():
    # Remove deployment guide fields from tasks table
    op.drop_column('tasks', 'deployment_guide_updated_at')
    op.drop_column('tasks', 'deployment_guide')