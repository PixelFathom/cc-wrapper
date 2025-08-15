"""Add AI test case generation fields

Revision ID: add_ai_test_case_fields
Revises: 52c9dddfe96f
Create Date: 2024-12-19 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_ai_test_case_fields'
down_revision = '52c9dddfe96f'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add new fields to test_cases table
    op.add_column('test_cases', sa.Column('source', sa.String(), nullable=False, server_default='manual'))
    op.add_column('test_cases', sa.Column('session_id', sa.String(), nullable=True))
    op.add_column('test_cases', sa.Column('generated_from_messages', sa.String(), nullable=True))
    op.add_column('test_cases', sa.Column('ai_model_used', sa.String(), nullable=True))


def downgrade() -> None:
    # Remove the new fields
    op.drop_column('test_cases', 'ai_model_used')
    op.drop_column('test_cases', 'generated_from_messages')
    op.drop_column('test_cases', 'session_id')
    op.drop_column('test_cases', 'source')