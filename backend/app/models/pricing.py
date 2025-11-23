from typing import List, Optional
from sqlmodel import SQLModel, Field
from app.models.base import BaseModel


class PricingPlan(BaseModel, table=True):
    __tablename__ = "pricing_plans"

    name: str = Field(..., description="Plan name (e.g., Free, Pro)")
    price: str = Field(..., description="Price display text (e.g., 'Free', '$29', 'Contact Us')")
    period: str = Field(..., description="Billing period (e.g., 'Forever', '/month', 'for pricing')")
    description: str = Field(..., description="Short plan description")
    features: str = Field(..., description="JSON string of features array")
    cta: str = Field(..., description="Call to action button text")
    is_popular: bool = Field(default=False, description="Whether this plan is marked as popular")
    is_active: bool = Field(default=True, description="Whether this plan is currently active")
    sort_order: int = Field(default=0, description="Display order")


# Response models
class PricingPlanResponse(SQLModel):
    id: str  # UUID as string
    name: str
    price: str
    period: str
    description: str
    features: List[str]
    cta: str
    is_popular: bool
    sort_order: int


class PricingPlansResponse(SQLModel):
    plans: List[PricingPlanResponse]