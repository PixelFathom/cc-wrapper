"""add deployment host field

Revision ID: add_deployment_host_field
Revises: add_deployment_hook_phase
Create Date: 2025-01-27 15:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'add_deployment_host_field'
down_revision = 'add_deployment_hook_phase'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add deployment_host field to tasks table
    op.add_column('tasks', sa.Column('deployment_host', sa.String(), nullable=True))


def downgrade() -> None:
    # Remove deployment_host field from tasks table
    op.drop_column('tasks', 'deployment_host')


