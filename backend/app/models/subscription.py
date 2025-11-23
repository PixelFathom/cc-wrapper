"""
Subscription tier and feature management enums and constants.
"""
from enum import Enum


class SubscriptionTier(str, Enum):
    """User subscription tiers with associated pricing and coin allocations."""
    FREE = "free"
    PREMIUM = "premium"  # Auto-activated when user has credits


class Feature(str, Enum):
    """Features that can be enabled or disabled based on subscription tier."""
    DEPLOYMENT_HOST = "deployment_host"
    GITHUB_ISSUES = "github_issues"
    TEST_CASES = "test_cases"
    VSCODE_ACCESS = "vscode_access"
    CONTEXT_HARVESTING = "context_harvesting"


# Credit packages (one-time purchases) - INR pricing
CREDIT_PACKAGES = {
    "starter": {
        "id": "starter",
        "name": "Starter",
        "price": 499,
        "credits": 2,
        "currency": "INR",
        "validity_days": 30,
    },
    "standard": {
        "id": "standard",
        "name": "Standard",
        "price": 999,
        "credits": 5,
        "currency": "INR",
        "validity_days": 30,
    },
    "advanced": {
        "id": "advanced",
        "name": "Advanced",
        "price": 1999,
        "credits": 12,
        "currency": "INR",
        "validity_days": 30,
    },
    "pro": {
        "id": "pro",
        "name": "Pro",
        "price": 2999,
        "credits": 20,
        "currency": "INR",
        "validity_days": 30,
    },
}

# Tier configuration: coins and enabled features
TIER_CONFIG = {
    SubscriptionTier.FREE: {
        "price": 0,
        "coins": 0,  # No coins for free tier
        "name": "Free",
        "enabled_features": set(),  # All features disabled
    },
    SubscriptionTier.PREMIUM: {
        "price": None,  # No fixed price, buy credits
        "coins": None,  # Variable based on credit purchase
        "name": "Premium",
        "enabled_features": {
            Feature.DEPLOYMENT_HOST,
            Feature.TEST_CASES,
            Feature.VSCODE_ACCESS,
            Feature.CONTEXT_HARVESTING,
            # Note: GITHUB_ISSUES is not available in any plan
        },
    },
}


def is_feature_enabled(tier: SubscriptionTier, feature: Feature) -> bool:
    """Check if a feature is enabled for a given tier."""
    config = TIER_CONFIG.get(tier)
    if not config:
        return False
    return feature in config["enabled_features"]


def get_tier_coin_allocation(tier: SubscriptionTier) -> int:
    """Get the coin allocation for a tier."""
    config = TIER_CONFIG.get(tier)
    if not config:
        return 0
    return config.get("coins", 0)


def get_tier_price(tier: SubscriptionTier) -> int:
    """Get the price for a tier in dollars."""
    config = TIER_CONFIG.get(tier)
    if not config:
        return 0
    return config.get("price", 0)


def get_credit_package(package_id: str) -> dict:
    """Get credit package details by ID."""
    return CREDIT_PACKAGES.get(package_id, {})


def get_all_credit_packages() -> dict:
    """Get all available credit packages."""
    return CREDIT_PACKAGES


def calculate_credit_expiry_date(purchase_date, validity_days: int = 30):
    """Calculate when credits will expire."""
    from datetime import timedelta
    return purchase_date + timedelta(days=validity_days)
