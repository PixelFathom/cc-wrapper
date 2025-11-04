"""change_github_ids_to_bigint

Revision ID: 19e419a3a5ee
Revises: add_chat_id_issue_res
Create Date: 2025-11-03 21:39:17.915544

"""
from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision = '19e419a3a5ee'
down_revision = 'add_chat_id_issue_res'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Change github_issue_id from integer to bigint in github_issues table
    op.alter_column('github_issues', 'github_issue_id',
                    existing_type=sa.Integer(),
                    type_=sa.BigInteger(),
                    existing_nullable=False)

    # Change github_repo_id from integer to bigint in github_repositories table
    op.alter_column('github_repositories', 'github_repo_id',
                    existing_type=sa.Integer(),
                    type_=sa.BigInteger(),
                    existing_nullable=False)


def downgrade() -> None:
    # Revert bigint to integer (may cause data loss if values exceed int32 range)
    op.alter_column('github_repositories', 'github_repo_id',
                    existing_type=sa.BigInteger(),
                    type_=sa.Integer(),
                    existing_nullable=False)

    op.alter_column('github_issues', 'github_issue_id',
                    existing_type=sa.BigInteger(),
                    type_=sa.Integer(),
                    existing_nullable=False)