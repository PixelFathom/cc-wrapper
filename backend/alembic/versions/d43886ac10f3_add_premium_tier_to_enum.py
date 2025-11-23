"""add_premium_tier_to_enum

Revision ID: d43886ac10f3
Revises: 30c8c00d45e0
Create Date: 2025-11-21 14:59:39.625663

"""
from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision = 'd43886ac10f3'
down_revision = '30c8c00d45e0'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add 'premium' value to subscriptiontier enum
    op.execute("ALTER TYPE subscriptiontier ADD VALUE IF NOT EXISTS 'premium'")


def downgrade() -> None:
    # Note: PostgreSQL doesn't support removing enum values directly
    # You would need to recreate the enum type if you want to remove 'premium'
    pass