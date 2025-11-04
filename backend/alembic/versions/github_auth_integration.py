"""add_github_authentication_tables

Revision ID: github_auth_001
Revises: 9a3b5d7e8f12
Create Date: 2024-10-18 00:00:00.000000

Adds GitHub OAuth authentication infrastructure:
1. users table - stores GitHub user profiles
2. user_tokens table - stores encrypted GitHub OAuth tokens
3. audit_logs table - tracks sensitive operations
4. Modifies projects table - adds user_id foreign key and GitHub metadata
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
import sqlmodel


# revision identifiers, used by Alembic.
revision = 'github_auth_001'
down_revision = '9a3b5d7e8f12'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create users table
    op.create_table(
        'users',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, primary_key=True),
        sa.Column('github_id', sa.Integer(), nullable=False),
        sa.Column('github_login', sa.String(length=255), nullable=False),
        sa.Column('github_name', sa.String(length=255), nullable=True),
        sa.Column('email', sa.String(length=255), nullable=True),
        sa.Column('avatar_url', sa.String(length=500), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.UniqueConstraint('github_id', name='uq_users_github_id'),
        sa.UniqueConstraint('github_login', name='uq_users_github_login'),
    )
    op.create_index('ix_users_github_id', 'users', ['github_id'])
    op.create_index('ix_users_github_login', 'users', ['github_login'])

    # Create user_tokens table
    op.create_table(
        'user_tokens',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('access_token_encrypted', sa.Text(), nullable=False),
        sa.Column('refresh_token_encrypted', sa.Text(), nullable=True),
        sa.Column('token_type', sa.String(length=50), nullable=False, server_default='bearer'),
        sa.Column('scope', sa.Text(), nullable=True),
        sa.Column('expires_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], name='fk_user_tokens_user_id'),
    )
    op.create_index('ix_user_tokens_user_id', 'user_tokens', ['user_id'])

    # Create audit_logs table
    op.create_table(
        'audit_logs',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('action', sa.String(length=100), nullable=False),
        sa.Column('resource_type', sa.String(length=50), nullable=True),
        sa.Column('resource_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('ip_address', sa.String(length=45), nullable=True),
        sa.Column('user_agent', sa.Text(), nullable=True),
        sa.Column('metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], name='fk_audit_logs_user_id'),
    )
    op.create_index('ix_audit_logs_user_id', 'audit_logs', ['user_id'])
    op.create_index('ix_audit_logs_action', 'audit_logs', ['action'])
    op.create_index('ix_audit_logs_resource_type', 'audit_logs', ['resource_type'])
    op.create_index('ix_audit_logs_resource_id', 'audit_logs', ['resource_id'])

    # Modify projects table - add user_id and GitHub fields
    op.add_column('projects', sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column('projects', sa.Column('github_repo_id', sa.Integer(), nullable=True))
    op.add_column('projects', sa.Column('github_owner', sa.String(length=255), nullable=True))
    op.add_column('projects', sa.Column('github_repo_name', sa.String(length=255), nullable=True))
    op.add_column('projects', sa.Column('is_private', sa.Boolean(), nullable=False, server_default='false'))

    # Add foreign key constraint
    op.create_foreign_key('fk_projects_user_id', 'projects', 'users', ['user_id'], ['id'])

    # Add indexes for better query performance
    op.create_index('ix_projects_user_id', 'projects', ['user_id'])
    op.create_index('ix_projects_github_repo_id', 'projects', ['github_repo_id'])


def downgrade() -> None:
    # Remove indexes and columns from projects table
    op.drop_index('ix_projects_github_repo_id', 'projects')
    op.drop_index('ix_projects_user_id', 'projects')
    op.drop_constraint('fk_projects_user_id', 'projects', type_='foreignkey')
    op.drop_column('projects', 'is_private')
    op.drop_column('projects', 'github_repo_name')
    op.drop_column('projects', 'github_owner')
    op.drop_column('projects', 'github_repo_id')
    op.drop_column('projects', 'user_id')

    # Drop audit_logs table
    op.drop_index('ix_audit_logs_resource_id', 'audit_logs')
    op.drop_index('ix_audit_logs_resource_type', 'audit_logs')
    op.drop_index('ix_audit_logs_action', 'audit_logs')
    op.drop_index('ix_audit_logs_user_id', 'audit_logs')
    op.drop_table('audit_logs')

    # Drop user_tokens table
    op.drop_index('ix_user_tokens_user_id', 'user_tokens')
    op.drop_table('user_tokens')

    # Drop users table
    op.drop_index('ix_users_github_login', 'users')
    op.drop_index('ix_users_github_id', 'users')
    op.drop_table('users')
