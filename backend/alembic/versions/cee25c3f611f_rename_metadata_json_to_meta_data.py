"""rename_metadata_json_to_meta_data

Revision ID: cee25c3f611f
Revises: dc4e2db3fffc
Create Date: 2025-11-03 08:17:03.966669

"""
from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision = 'cee25c3f611f'
down_revision = 'dc4e2db3fffc'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Rename metadata_json column to meta_data in audit_logs table
    op.alter_column(
        'audit_logs',
        'metadata_json',
        new_column_name='meta_data'
    )


def downgrade() -> None:
    # Rename meta_data column back to metadata_json
    op.alter_column(
        'audit_logs',
        'meta_data',
        new_column_name='metadata_json'
    )