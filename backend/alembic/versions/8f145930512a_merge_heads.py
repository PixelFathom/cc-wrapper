"""merge_heads

Revision ID: 8f145930512a
Revises: add_ai_test_case_fields, github_auth_001
Create Date: 2025-11-03 08:05:40.351675

"""
from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision = '8f145930512a'
down_revision = ('add_ai_test_case_fields', 'github_auth_001')
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass