"""add_github_repository_id_to_projects

Revision ID: dc4e2db3fffc
Revises: 1bc240b13975
Create Date: 2025-11-03 08:13:50.814281

"""
from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision = 'dc4e2db3fffc'
down_revision = '1bc240b13975'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add github_repository_id column to projects table
    op.add_column(
        'projects',
        sa.Column('github_repository_id', sa.UUID(), nullable=True)
    )

    # Add foreign key constraint
    op.create_foreign_key(
        'fk_projects_github_repository_id',
        'projects',
        'github_repositories',
        ['github_repository_id'],
        ['id']
    )

    # Add index for better query performance
    op.create_index(
        'ix_projects_github_repository_id',
        'projects',
        ['github_repository_id']
    )


def downgrade() -> None:
    # Remove index
    op.drop_index('ix_projects_github_repository_id', 'projects')

    # Remove foreign key constraint
    op.drop_constraint('fk_projects_github_repository_id', 'projects', type_='foreignkey')

    # Remove column
    op.drop_column('projects', 'github_repository_id')