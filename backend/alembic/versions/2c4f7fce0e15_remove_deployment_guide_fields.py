"""remove_deployment_guide_fields

Revision ID: 2c4f7fce0e15
Revises: add_deployment_host_field
Create Date: 2025-11-19 20:50:01.260319

"""
from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision = '2c4f7fce0e15'
down_revision = 'add_deployment_host_field'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Remove deployment_guide fields from tasks table
    op.drop_column('tasks', 'deployment_guide')
    op.drop_column('tasks', 'deployment_guide_updated_at')


def downgrade() -> None:
    # Add back deployment_guide fields to tasks table
    op.add_column('tasks', sa.Column('deployment_guide', sa.String(), nullable=True))
    op.add_column('tasks', sa.Column('deployment_guide_updated_at', sa.DateTime(), nullable=True))