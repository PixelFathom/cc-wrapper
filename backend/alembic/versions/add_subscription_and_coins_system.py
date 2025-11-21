"""add_subscription_and_coins_system

Revision ID: c8e3f9a4b5d7
Revises: add_deployment_host_field
Create Date: 2025-11-21 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
import sqlmodel
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'c8e3f9a4b5d7'
down_revision = '1beed1f47ecb'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create subscription tier enum (drop if exists first)
    op.execute("DROP TYPE IF EXISTS subscriptiontier CASCADE")
    op.execute("CREATE TYPE subscriptiontier AS ENUM ('free', 'tier_1', 'tier_2', 'tier_3')")

    # Create transaction type enum (drop if exists first)
    op.execute("DROP TYPE IF EXISTS transactiontype CASCADE")
    op.execute("CREATE TYPE transactiontype AS ENUM ('allocation', 'usage', 'refund', 'adjustment', 'expiry')")

    # Add subscription fields to users table
    op.add_column('users', sa.Column(
        'subscription_tier',
        postgresql.ENUM('free', 'tier_1', 'tier_2', 'tier_3', name='subscriptiontier', create_type=False),
        nullable=False,
        server_default=sa.text("'free'")
    ))
    op.add_column('users', sa.Column('coins_balance', sa.Integer(), nullable=False, server_default='2'))
    op.add_column('users', sa.Column('coins_total_allocated', sa.Integer(), nullable=False, server_default='2'))
    op.add_column('users', sa.Column('coins_total_used', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('users', sa.Column('subscription_start_date', sa.DateTime(), nullable=True))
    op.add_column('users', sa.Column('subscription_end_date', sa.DateTime(), nullable=True))
    op.add_column('users', sa.Column('subscription_renews_at', sa.DateTime(), nullable=True))
    op.add_column('users', sa.Column('stripe_customer_id', sa.String(length=255), nullable=True))
    op.add_column('users', sa.Column('stripe_subscription_id', sa.String(length=255), nullable=True))

    # Create indexes for subscription fields
    op.create_index('ix_users_subscription_tier', 'users', ['subscription_tier'])
    op.create_index('ix_users_stripe_customer_id', 'users', ['stripe_customer_id'])

    # Create coin_transactions table
    op.create_table(
        'coin_transactions',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('amount', sa.Integer(), nullable=False),
        sa.Column(
            'transaction_type',
            postgresql.ENUM('allocation', 'usage', 'refund', 'adjustment', 'expiry', name='transactiontype', create_type=False),
            nullable=False
        ),
        sa.Column('description', sa.String(length=500), nullable=False),
        sa.Column('reference_id', sa.String(length=255), nullable=True),
        sa.Column('reference_type', sa.String(length=50), nullable=True),
        sa.Column('balance_after', sa.Integer(), nullable=False),
        sa.Column('meta_data', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    # Create indexes for coin_transactions
    op.create_index('ix_coin_transactions_user_id', 'coin_transactions', ['user_id'])
    op.create_index('ix_coin_transactions_transaction_type', 'coin_transactions', ['transaction_type'])
    op.create_index('ix_coin_transactions_reference_id', 'coin_transactions', ['reference_id'])


def downgrade() -> None:
    # Drop coin_transactions table and indexes
    op.drop_index('ix_coin_transactions_reference_id', table_name='coin_transactions')
    op.drop_index('ix_coin_transactions_transaction_type', table_name='coin_transactions')
    op.drop_index('ix_coin_transactions_user_id', table_name='coin_transactions')
    op.drop_table('coin_transactions')

    # Drop user subscription indexes
    op.drop_index('ix_users_stripe_customer_id', table_name='users')
    op.drop_index('ix_users_subscription_tier', table_name='users')

    # Drop user subscription columns
    op.drop_column('users', 'stripe_subscription_id')
    op.drop_column('users', 'stripe_customer_id')
    op.drop_column('users', 'subscription_renews_at')
    op.drop_column('users', 'subscription_end_date')
    op.drop_column('users', 'subscription_start_date')
    op.drop_column('users', 'coins_total_used')
    op.drop_column('users', 'coins_total_allocated')
    op.drop_column('users', 'coins_balance')
    op.drop_column('users', 'subscription_tier')

    # Drop enums
    op.execute('DROP TYPE IF EXISTS transactiontype')
    op.execute('DROP TYPE IF EXISTS subscriptiontier')
