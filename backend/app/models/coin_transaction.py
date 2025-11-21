"""
Coin transaction model for tracking coin usage and allocations.
"""
from sqlmodel import Field, Relationship, Column
from sqlalchemy import JSON, Enum as SQLAlchemyEnum
from typing import Optional, TYPE_CHECKING, Any
from uuid import UUID
from enum import Enum
from .base import BaseModel

if TYPE_CHECKING:
    from .user import User


class TransactionType(str, Enum):
    """Types of coin transactions."""
    ALLOCATION = "allocation"  # Coins added to account (subscription, purchase)
    USAGE = "usage"  # Coins deducted for service usage
    REFUND = "refund"  # Coins refunded
    ADJUSTMENT = "adjustment"  # Manual adjustment by admin
    EXPIRY = "expiry"  # Coins expired


class CoinTransaction(BaseModel, table=True):
    """
    Tracks all coin transactions for audit trail and usage analytics.
    """
    __tablename__ = "coin_transactions"

    # Foreign keys
    user_id: UUID = Field(foreign_key="users.id", index=True, nullable=False)

    # Transaction details
    amount: int = Field(nullable=False)  # Positive for credit, negative for debit
    transaction_type: TransactionType = Field(
        sa_column=Column(
            SQLAlchemyEnum(TransactionType, name="transactiontype", values_callable=lambda x: [e.value for e in x]),
            nullable=False,
            index=True
        )
    )
    description: str = Field(max_length=500, nullable=False)

    # Reference to related entity (chat_id, task_id, etc.)
    reference_id: Optional[str] = Field(default=None, max_length=255, index=True)
    reference_type: Optional[str] = Field(default=None, max_length=50)  # "chat", "task", etc.

    # Balance after this transaction (for quick balance verification)
    balance_after: int = Field(nullable=False)

    # Metadata for additional context (renamed from metadata to avoid SQLAlchemy conflict)
    meta_data: Optional[dict[str, Any]] = Field(default=None, sa_column=Column(JSON))

    # Relationships
    user: "User" = Relationship(back_populates="coin_transactions")
