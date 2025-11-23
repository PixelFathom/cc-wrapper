"use client";

import { ReactNode } from "react";
import { useFeatureAccess } from "@/lib/hooks/useSubscription";
import { Feature, FEATURE_CONFIGS, TIER_CONFIGS } from "@/lib/subscription-types";
import { FeatureLockedCard } from "./FeatureLockedCard";
import { Skeleton } from "@/components/ui/skeleton";

interface FeatureGuardProps {
  feature: Feature;
  children: ReactNode;
  fallback?: ReactNode;
  loadingFallback?: ReactNode;
}

/**
 * Component that guards feature access based on subscription tier.
 * Shows locked card if user doesn't have access to the feature.
 */
export function FeatureGuard({
  feature,
  children,
  fallback,
  loadingFallback,
}: FeatureGuardProps) {
  const { hasAccess, isLoading, requiredTier, currentTier } = useFeatureAccess(feature);

  if (isLoading) {
    if (loadingFallback) {
      return <>{loadingFallback}</>;
    }

    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!hasAccess) {
    if (fallback) {
      return <>{fallback}</>;
    }

    const featureConfig = FEATURE_CONFIGS[feature];
    const requiredTierConfig = requiredTier || TIER_CONFIGS[featureConfig.requiredTier];

    return (
      <div className="p-6">
        <FeatureLockedCard
          featureName={featureConfig.name}
          featureIcon={featureConfig.icon}
          featureDescription={featureConfig.description}
          benefits={featureConfig.benefits}
          requiredTier={requiredTierConfig}
          currentTier={currentTier?.name || "Free"}
        />
      </div>
    );
  }

  return <>{children}</>;
}
