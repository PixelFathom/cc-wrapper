/**
 * Subscription system type definitions
 */

export enum SubscriptionTier {
  FREE = "free",
  PREMIUM = "premium",
}

export enum Feature {
  DEPLOYMENT_HOST = "deployment_host",
  GITHUB_ISSUES = "github_issues",
  TEST_CASES = "test_cases",
  VSCODE_ACCESS = "vscode_access",
  CONTEXT_HARVESTING = "context_harvesting",
}

export enum TransactionType {
  ALLOCATION = "allocation",
  USAGE = "usage",
  REFUND = "refund",
  ADJUSTMENT = "adjustment",
  EXPIRY = "expiry",
}

export interface Subscription {
  user_id: string;
  subscription_tier: SubscriptionTier;
  tier_name: string;
  coins_balance: number;
  coins_total_allocated: number;
  coins_total_used: number;
  subscription_start_date: string | null;
  subscription_end_date: string | null;
  subscription_renews_at: string | null;
  enabled_features: Feature[];
}

export interface CoinTransaction {
  id: string;
  amount: number;
  transaction_type: TransactionType;
  description: string;
  reference_id: string | null;
  reference_type: string | null;
  balance_after: number;
  metadata: Record<string, any> | null;
  created_at: string;
}

export interface TierConfig {
  name: string;
  price: number | null;
  coins: number | string;
  popular?: boolean;
  features: {
    name: string;
    included: boolean;
  }[];
  benefits?: string[];
  description?: string;
}

export const TIER_CONFIGS: Record<SubscriptionTier, TierConfig> = {
  [SubscriptionTier.FREE]: {
    name: "Free",
    price: 0,
    coins: 2,
    description: "Get started with basic features",
    features: [
      { name: "2 coins per month", included: true },
      { name: "Chat messages", included: true },
      { name: "Basic project management", included: true },
      { name: "Deployment Host", included: false },
      { name: "Test Cases", included: false },
      { name: "VS Code Access", included: false },
      { name: "GitHub Issues", included: false },
      { name: "Context Harvesting", included: false },
    ],
  },
  [SubscriptionTier.PREMIUM]: {
    name: "Premium",
    price: null,
    coins: "Variable",
    popular: true,
    description: "Active when you have credits",
    features: [
      { name: "All credits from your purchases", included: true },
      { name: "Chat messages", included: true },
      { name: "Project management", included: true },
      { name: "Deployment Host", included: true },
      { name: "Test Cases", included: true },
      { name: "VS Code Access", included: true },
      { name: "Context Harvesting", included: true },
      { name: "GitHub Issues", included: false },
    ],
    benefits: [
      "All premium features unlocked",
      "Credits valid for 30 days",
      "Purchase multiple packages",
      "Auto-activated with credits",
    ],
  },
};

export const FEATURE_CONFIGS: Record<Feature, {
  name: string;
  icon: string;
  description: string;
  benefits: string[];
  requiredTier: SubscriptionTier;
}> = {
  [Feature.DEPLOYMENT_HOST]: {
    name: "Deployment Host",
    icon: "🚀",
    description: "Deploy your applications with one click",
    benefits: [
      "One-click deployment",
      "Automatic scaling",
      "Custom domains",
      "SSL certificates",
    ],
    requiredTier: SubscriptionTier.PREMIUM,
  },
  [Feature.TEST_CASES]: {
    name: "Test Cases",
    icon: "🧪",
    description: "AI-powered test case generation and execution",
    benefits: [
      "Generate test cases from conversations",
      "Execute tests automatically",
      "Track test results over time",
      "AI-powered test suggestions",
    ],
    requiredTier: SubscriptionTier.PREMIUM,
  },
  [Feature.VSCODE_ACCESS]: {
    name: "VS Code Access",
    icon: "💻",
    description: "Cloud-based VS Code environment",
    benefits: [
      "Cloud-based development",
      "Pre-configured environments",
      "Collaborative editing",
      "Persistent workspaces",
    ],
    requiredTier: SubscriptionTier.PREMIUM,
  },
  [Feature.GITHUB_ISSUES]: {
    name: "GitHub Issues",
    icon: "🐛",
    description: "Seamless GitHub issues integration (Coming Soon)",
    benefits: [
      "Auto-sync GitHub issues to tasks",
      "Generate tasks from issues",
      "Track issue resolution progress",
      "Automatic PR creation",
    ],
    requiredTier: SubscriptionTier.PREMIUM, // Not currently available
  },
  [Feature.CONTEXT_HARVESTING]: {
    name: "Context Harvesting",
    icon: "🌾",
    description: "Extract and organize knowledge from conversations",
    benefits: [
      "Extract structured knowledge",
      "Build knowledge base automatically",
      "Question-answer collection",
      "Context-aware AI responses",
    ],
    requiredTier: SubscriptionTier.PREMIUM,
  },
};
