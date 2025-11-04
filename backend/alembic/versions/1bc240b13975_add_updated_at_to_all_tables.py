"""add_updated_at_to_all_tables

Revision ID: 1bc240b13975
Revises: b9cf980e1b8f
Create Date: 2025-11-03 08:12:08.363949

"""
from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision = '1bc240b13975'
down_revision = 'b9cf980e1b8f'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # List of tables that need updated_at column
    tables = [
        'approval_requests',
        'approvals',
        'audit_logs',
        'chat_hooks',
        'chats',
        'contest_harvesting_sessions',
        'deployment_hooks',
        'files',
        'github_repositories',
        'harvesting_questions',
        'knowledge_base_files',
        'projects',
        'sub_projects',
        'tasks',
        'test_case_hooks',
        'test_cases',
    ]

    # Add updated_at column to each table
    for table in tables:
        op.add_column(
            table,
            sa.Column(
                'updated_at',
                sa.DateTime(),
                nullable=False,
                server_default=sa.text('CURRENT_TIMESTAMP')
            )
        )


def downgrade() -> None:
    # List of tables to remove updated_at from
    tables = [
        'approval_requests',
        'approvals',
        'audit_logs',
        'chat_hooks',
        'chats',
        'contest_harvesting_sessions',
        'deployment_hooks',
        'files',
        'github_repositories',
        'harvesting_questions',
        'knowledge_base_files',
        'projects',
        'sub_projects',
        'tasks',
        'test_case_hooks',
        'test_cases',
    ]

    # Remove updated_at column from each table
    for table in tables:
        op.drop_column(table, 'updated_at')