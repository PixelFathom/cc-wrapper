"""
Subscription tier and feature management enums and constants.
"""
from enum import Enum


class SubscriptionTier(str, Enum):
    """User subscription tiers with associated pricing and coin allocations."""
    FREE = "free"
    TIER_1 = "tier_1"
    TIER_2 = "tier_2"
    TIER_3 = "tier_3"


class Feature(str, Enum):
    """Features that can be enabled or disabled based on subscription tier."""
    DEPLOYMENT_HOST = "deployment_host"
    GITHUB_ISSUES = "github_issues"
    TEST_CASES = "test_cases"
    VSCODE_ACCESS = "vscode_access"
    CONTEXT_HARVESTING = "context_harvesting"


# Tier configuration: price, coins, and enabled features
TIER_CONFIG = {
    SubscriptionTier.FREE: {
        "price": 0,
        "coins": 2,
        "name": "Free Tier",
        "enabled_features": set(),  # All features disabled
    },
    SubscriptionTier.TIER_1: {
        "price": 19,
        "coins": 5,
        "name": "Starter",
        "enabled_features": {
            Feature.DEPLOYMENT_HOST,
            Feature.VSCODE_ACCESS,
        },
    },
    SubscriptionTier.TIER_2: {
        "price": 99,
        "coins": 20,
        "name": "Professional",
        "enabled_features": {
            Feature.DEPLOYMENT_HOST,
            Feature.TEST_CASES,
            Feature.VSCODE_ACCESS,
            Feature.CONTEXT_HARVESTING,
        },
    },
    SubscriptionTier.TIER_3: {
        "price": None,  # Custom pricing
        "coins": None,  # Unlimited or custom
        "name": "Enterprise",
        "enabled_features": {
            Feature.DEPLOYMENT_HOST,
            Feature.GITHUB_ISSUES,
            Feature.TEST_CASES,
            Feature.VSCODE_ACCESS,
            Feature.CONTEXT_HARVESTING,
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
