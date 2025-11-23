"""add_hosting_fields_to_task

Revision ID: 844368e6b670
Revises: d43886ac10f3
Create Date: 2025-11-23 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '844368e6b670'
down_revision = 'd43886ac10f3'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add hosting fields to tasks table
    op.add_column('tasks', sa.Column('hosting_subdomain', sa.String(), nullable=True))
    op.add_column('tasks', sa.Column('hosting_fqdn', sa.String(), nullable=True))
    op.add_column('tasks', sa.Column('hosting_status', sa.String(), nullable=True))
    op.add_column('tasks', sa.Column('hosting_provisioned_at', sa.DateTime(), nullable=True))
    op.add_column('tasks', sa.Column('hosting_removed_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    # Remove hosting fields from tasks table
    op.drop_column('tasks', 'hosting_removed_at')
    op.drop_column('tasks', 'hosting_provisioned_at')
    op.drop_column('tasks', 'hosting_status')
    op.drop_column('tasks', 'hosting_fqdn')
    op.drop_column('tasks', 'hosting_subdomain')
