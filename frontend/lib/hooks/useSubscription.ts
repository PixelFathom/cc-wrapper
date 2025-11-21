/**
 * React hooks for subscription management
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Subscription,
  CoinTransaction,
  SubscriptionTier,
  Feature,
  TransactionType,
  TIER_CONFIGS,
} from "@/lib/subscription-types";

/**
 * Hook to get current user's subscription details
 */
export function useSubscription() {
  const { data, isLoading, error } = useQuery<Subscription>({
    queryKey: ["subscription"],
    queryFn: async () => {
      try {
        const response = await api.getSubscription();
        return response;
      } catch (err) {
        console.error("Failed to fetch subscription:", err);
        throw err;
      }
    },
    staleTime: 30000, // 30 seconds
    retry: 2,
    enabled: typeof window !== 'undefined' && !!localStorage.getItem('github_user'),
  });

  return {
    subscription: data,
    tier: data?.subscription_tier || SubscriptionTier.FREE,
    tierName: data?.tier_name || "Free",
    coins: data?.coins_balance || 0,
    features: data?.enabled_features || [],
    isLoading,
    error,
  };
}

/**
 * Hook to get coin balance (lightweight alternative to full subscription)
 */
export function useCoinBalance() {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery<{ coins_balance: number; subscription_tier: string }>({
    queryKey: ["coin-balance"],
    queryFn: async () => {
      try {
        const response = await api.getCoinBalance();
        return response;
      } catch (err) {
        console.error("Failed to fetch coin balance:", err);
        throw err;
      }
    },
    staleTime: 10000, // 10 seconds
    retry: 2,
    enabled: typeof window !== 'undefined' && !!localStorage.getItem('github_user'),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["coin-balance"] });
    queryClient.invalidateQueries({ queryKey: ["subscription"] });
  };

  return {
    balance: data?.coins_balance || 0,
    tier: data?.subscription_tier || SubscriptionTier.FREE,
    isLoading,
    error,
    refresh,
  };
}

/**
 * Hook to check if user has access to a specific feature
 */
export function useFeatureAccess(feature: Feature) {
  const { subscription, features, tier } = useSubscription();

  const hasAccess = features.includes(feature);
  const requiredTierKey = Object.entries(TIER_CONFIGS).find(([_, config]) =>
    config.features.some(f => f.name.toLowerCase().includes(feature.replace(/_/g, " ")))
  )?.[0] as SubscriptionTier | undefined;

  const requiredTier = requiredTierKey ? TIER_CONFIGS[requiredTierKey] : null;
  const currentTier = TIER_CONFIGS[tier];

  return {
    hasAccess,
    isLoading: !subscription,
    requiredTier,
    currentTier,
    tier,
  };
}

/**
 * Hook to get transaction history
 */
export function useTransactionHistory(
  limit = 100,
  offset = 0,
  transactionType?: TransactionType
) {
  const { data, isLoading, error } = useQuery<{
    user_id: string;
    transactions: CoinTransaction[];
    limit: number;
    offset: number;
  }>({
    queryKey: ["transactions", limit, offset, transactionType],
    queryFn: async () => {
      try {
        const response = await api.getTransactionHistory(limit, offset, transactionType);
        return response;
      } catch (err) {
        console.error("Failed to fetch transaction history:", err);
        throw err;
      }
    },
    retry: 2,
    enabled: typeof window !== 'undefined' && !!localStorage.getItem('github_user'),
  });

  return {
    transactions: data?.transactions || [],
    isLoading,
    error,
  };
}

/**
 * Hook to upgrade subscription
 */
export function useUpgradeSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      tier,
      stripeSubscriptionId,
    }: {
      tier: SubscriptionTier;
      stripeSubscriptionId?: string;
    }) => {
      const response = await api.post("/subscription/upgrade", {
        tier,
        stripe_subscription_id: stripeSubscriptionId,
      });
      return response.data;
    },
    onSuccess: () => {
      // Invalidate and refetch subscription data
      queryClient.invalidateQueries({ queryKey: ["subscription"] });
      queryClient.invalidateQueries({ queryKey: ["coin-balance"] });
    },
  });
}

/**
 * Hook to cancel subscription
 */
export function useCancelSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await api.post("/subscription/cancel");
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscription"] });
      queryClient.invalidateQueries({ queryKey: ["coin-balance"] });
    },
  });
}
