"""
Payment model for tracking Cashfree payment orders and transactions.
"""
from sqlmodel import Field, Relationship, Column
from sqlalchemy import JSON, Enum as SQLAlchemyEnum
from typing import Optional, TYPE_CHECKING, Any
from uuid import UUID
from enum import Enum
from datetime import datetime
from .base import BaseModel

if TYPE_CHECKING:
    from .user import User


class PaymentStatus(str, Enum):
    """Payment status states."""
    PENDING = "pending"  # Order created, waiting for payment
    ACTIVE = "active"  # Payment in progress
    SUCCESS = "success"  # Payment completed successfully
    FAILED = "failed"  # Payment failed
    CANCELLED = "cancelled"  # Payment cancelled by user
    EXPIRED = "expired"  # Payment session expired
    REFUNDED = "refunded"  # Payment refunded


class PaymentProvider(str, Enum):
    """Payment gateway providers."""
    CASHFREE = "cashfree"
    STRIPE = "stripe"  # For future use
    RAZORPAY = "razorpay"  # For future use


class Payment(BaseModel, table=True):
    """
    Tracks all payment orders and transactions.
    Links subscription upgrades with payment gateway transactions.
    """
    __tablename__ = "payments"

    # Foreign keys
    user_id: UUID = Field(foreign_key="users.id", index=True, nullable=False)

    # Payment gateway details
    payment_provider: PaymentProvider = Field(
        sa_column=Column(
            SQLAlchemyEnum(PaymentProvider, name="paymentprovider", values_callable=lambda x: [e.value for e in x]),
            nullable=False
        )
    )
    order_id: str = Field(max_length=255, nullable=False, index=True, unique=True)  # Cashfree order_id
    payment_session_id: Optional[str] = Field(default=None, max_length=255)  # Cashfree session ID

    # Payment details
    amount: float = Field(nullable=False)  # Amount in specified currency
    currency: str = Field(max_length=3, default="INR")  # Currency code (INR for Cashfree)
    status: PaymentStatus = Field(
        default=PaymentStatus.PENDING,
        sa_column=Column(
            SQLAlchemyEnum(PaymentStatus, name="paymentstatus", values_callable=lambda x: [e.value for e in x]),
            nullable=False,
            index=True
        )
    )

    # Subscription details
    subscription_tier: str = Field(max_length=50, nullable=False)  # tier_1, tier_2, tier_3

    # Transaction details (from payment gateway)
    transaction_id: Optional[str] = Field(default=None, max_length=255, index=True)  # Cashfree cf_payment_id
    payment_method: Optional[str] = Field(default=None, max_length=100)  # UPI, CARD, NETBANKING, etc.
    bank_reference: Optional[str] = Field(default=None, max_length=255)  # Bank transaction reference

    # Customer details
    customer_email: Optional[str] = Field(default=None, max_length=255)
    customer_phone: Optional[str] = Field(default=None, max_length=20)

    # Timestamps
    payment_initiated_at: datetime = Field(default_factory=datetime.utcnow)
    payment_completed_at: Optional[datetime] = Field(default=None)
    payment_failed_at: Optional[datetime] = Field(default=None)

    # Refund details
    refund_initiated_at: Optional[datetime] = Field(default=None)
    refund_completed_at: Optional[datetime] = Field(default=None)
    refund_amount: Optional[float] = Field(default=None)
    refund_id: Optional[str] = Field(default=None, max_length=255)  # Cashfree refund ID

    # Error details
    error_code: Optional[str] = Field(default=None, max_length=100)
    error_message: Optional[str] = Field(default=None, max_length=1000)

    # Metadata for additional context
    meta_data: Optional[dict[str, Any]] = Field(default=None, sa_column=Column(JSON))

    # Webhook tracking
    webhook_received_at: Optional[datetime] = Field(default=None)
    webhook_count: int = Field(default=0)  # Track how many webhooks received for this payment

    # Relationships
    user: "User" = Relationship(back_populates="payments")
