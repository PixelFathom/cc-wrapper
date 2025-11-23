"""add deployment hook phase

Revision ID: add_deployment_hook_phase
Revises: add_deployment_task_fields
Create Date: 2025-11-18 19:30:00.000000

"""
from alembic import op
import sqlalchemy as sa
import sqlmodel

revision = 'add_deployment_hook_phase'
down_revision = 'add_deployment_task_fields'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('deployment_hooks', sa.Column('phase', sqlmodel.sql.sqltypes.AutoString(), nullable=True))
    # Set default phase for existing records based on hook_type
    op.execute("UPDATE deployment_hooks SET phase = 'initialization' WHERE hook_type = 'init_project'")
    op.execute("UPDATE deployment_hooks SET phase = 'deployment' WHERE hook_type != 'init_project' OR hook_type IS NULL")


def downgrade() -> None:
    op.drop_column('deployment_hooks', 'phase')

