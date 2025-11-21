from sqlmodel import Field, Relationship, Column
from sqlalchemy import Enum as SQLAlchemyEnum
from typing import List, Optional, TYPE_CHECKING
from datetime import datetime
from uuid import UUID
from .base import BaseModel
from .subscription import SubscriptionTier

if TYPE_CHECKING:
    from .user_token import UserToken
    from .project import Project
    from .audit_log import AuditLog
    from .coin_transaction import CoinTransaction


class User(BaseModel, table=True):
    """
    User model for GitHub-authenticated users.
    Stores core GitHub profile information and subscription details.
    """
    __tablename__ = "users"

    # GitHub identity
    github_id: int = Field(unique=True, index=True, nullable=False)
    github_login: str = Field(unique=True, index=True, max_length=255, nullable=False)
    github_name: Optional[str] = Field(default=None, max_length=255)

    # Contact & profile
    email: Optional[str] = Field(default=None, max_length=255)
    avatar_url: Optional[str] = Field(default=None, max_length=500)

    # GitHub profile metadata
    bio: Optional[str] = Field(default=None)
    company: Optional[str] = Field(default=None, max_length=255)
    location: Optional[str] = Field(default=None, max_length=255)
    blog: Optional[str] = Field(default=None, max_length=500)

    # GitHub stats (cached)
    public_repos: int = Field(default=0)
    followers: int = Field(default=0)
    following: int = Field(default=0)

    # Account management
    is_active: bool = Field(default=True)
    is_admin: bool = Field(default=False)
    last_login_at: Optional[datetime] = Field(default=None)

    # Subscription & Billing
    subscription_tier: SubscriptionTier = Field(
        default=SubscriptionTier.FREE,
        sa_column=Column(
            SQLAlchemyEnum(SubscriptionTier, name="subscriptiontier", values_callable=lambda x: [e.value for e in x]),
            index=True,
            nullable=False,
            server_default="free"
        )
    )
    coins_balance: int = Field(default=2, nullable=False)  # Current coin balance
    coins_total_allocated: int = Field(default=2, nullable=False)  # Total coins ever allocated
    coins_total_used: int = Field(default=0, nullable=False)  # Total coins ever used

    # Subscription period tracking (for monthly renewal)
    subscription_start_date: Optional[datetime] = Field(default=None)
    subscription_end_date: Optional[datetime] = Field(default=None)
    subscription_renews_at: Optional[datetime] = Field(default=None)

    # Payment tracking
    stripe_customer_id: Optional[str] = Field(default=None, max_length=255, index=True)
    stripe_subscription_id: Optional[str] = Field(default=None, max_length=255)

    # Relationships
    tokens: List["UserToken"] = Relationship(back_populates="user")
    projects: List["Project"] = Relationship(back_populates="user")
    audit_logs: List["AuditLog"] = Relationship(back_populates="user")
    coin_transactions: List["CoinTransaction"] = Relationship(back_populates="user")
