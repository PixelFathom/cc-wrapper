"""add_payment_tracking_and_phone

Revision ID: d9f4a6c7e8b9
Revises: c8e3f9a4b5d7
Create Date: 2025-11-21 14:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
import sqlmodel
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'd9f4a6c7e8b9'
down_revision = 'c8e3f9a4b5d7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create payment status enum
    op.execute("DROP TYPE IF EXISTS paymentstatus CASCADE")
    op.execute("CREATE TYPE paymentstatus AS ENUM ('pending', 'active', 'success', 'failed', 'cancelled', 'expired', 'refunded')")

    # Create payment provider enum
    op.execute("DROP TYPE IF EXISTS paymentprovider CASCADE")
    op.execute("CREATE TYPE paymentprovider AS ENUM ('cashfree', 'stripe', 'razorpay')")

    # Add phone number to users table
    op.add_column('users', sa.Column('phone', sa.String(length=20), nullable=True))

    # Create payments table
    op.create_table(
        'payments',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column(
            'payment_provider',
            postgresql.ENUM('cashfree', 'stripe', 'razorpay', name='paymentprovider', create_type=False),
            nullable=False
        ),
        sa.Column('order_id', sa.String(length=255), nullable=False),
        sa.Column('payment_session_id', sa.String(length=255), nullable=True),
        sa.Column('amount', sa.Float(), nullable=False),
        sa.Column('currency', sa.String(length=3), nullable=False, server_default='USD'),
        sa.Column(
            'status',
            postgresql.ENUM('pending', 'active', 'success', 'failed', 'cancelled', 'expired', 'refunded', name='paymentstatus', create_type=False),
            nullable=False,
            server_default='pending'
        ),
        sa.Column('subscription_tier', sa.String(length=50), nullable=False),
        sa.Column('transaction_id', sa.String(length=255), nullable=True),
        sa.Column('payment_method', sa.String(length=100), nullable=True),
        sa.Column('bank_reference', sa.String(length=255), nullable=True),
        sa.Column('customer_email', sa.String(length=255), nullable=True),
        sa.Column('customer_phone', sa.String(length=20), nullable=True),
        sa.Column('payment_initiated_at', sa.DateTime(), nullable=False),
        sa.Column('payment_completed_at', sa.DateTime(), nullable=True),
        sa.Column('payment_failed_at', sa.DateTime(), nullable=True),
        sa.Column('refund_initiated_at', sa.DateTime(), nullable=True),
        sa.Column('refund_completed_at', sa.DateTime(), nullable=True),
        sa.Column('refund_amount', sa.Float(), nullable=True),
        sa.Column('refund_id', sa.String(length=255), nullable=True),
        sa.Column('error_code', sa.String(length=100), nullable=True),
        sa.Column('error_message', sa.String(length=1000), nullable=True),
        sa.Column('meta_data', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('webhook_received_at', sa.DateTime(), nullable=True),
        sa.Column('webhook_count', sa.Integer(), nullable=False, server_default='0'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('order_id')
    )

    # Create indexes for payments table
    op.create_index('ix_payments_user_id', 'payments', ['user_id'])
    op.create_index('ix_payments_order_id', 'payments', ['order_id'])
    op.create_index('ix_payments_transaction_id', 'payments', ['transaction_id'])
    op.create_index('ix_payments_status', 'payments', ['status'])


def downgrade() -> None:
    # Drop payments table and indexes
    op.drop_index('ix_payments_status', table_name='payments')
    op.drop_index('ix_payments_transaction_id', table_name='payments')
    op.drop_index('ix_payments_order_id', table_name='payments')
    op.drop_index('ix_payments_user_id', table_name='payments')
    op.drop_table('payments')

    # Drop phone column from users
    op.drop_column('users', 'phone')

    # Drop enums
    op.execute('DROP TYPE IF EXISTS paymentprovider')
    op.execute('DROP TYPE IF EXISTS paymentstatus')
