"""add_missing_user_profile_fields

Revision ID: b9cf980e1b8f
Revises: 8f145930512a
Create Date: 2025-11-03 08:06:13.498495

"""
from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision = 'b9cf980e1b8f'
down_revision = '8f145930512a'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add missing user profile fields
    op.add_column('users', sa.Column('bio', sa.Text(), nullable=True))
    op.add_column('users', sa.Column('company', sa.String(length=255), nullable=True))
    op.add_column('users', sa.Column('location', sa.String(length=255), nullable=True))
    op.add_column('users', sa.Column('blog', sa.String(length=500), nullable=True))

    # Add GitHub stats fields
    op.add_column('users', sa.Column('public_repos', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('users', sa.Column('followers', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('users', sa.Column('following', sa.Integer(), nullable=False, server_default='0'))

    # Add account management fields
    op.add_column('users', sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'))
    op.add_column('users', sa.Column('is_admin', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('users', sa.Column('last_login_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    # Remove all added columns in reverse order
    op.drop_column('users', 'last_login_at')
    op.drop_column('users', 'is_admin')
    op.drop_column('users', 'is_active')
    op.drop_column('users', 'following')
    op.drop_column('users', 'followers')
    op.drop_column('users', 'public_repos')
    op.drop_column('users', 'blog')
    op.drop_column('users', 'location')
    op.drop_column('users', 'company')
    op.drop_column('users', 'bio')