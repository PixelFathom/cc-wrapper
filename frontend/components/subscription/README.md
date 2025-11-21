# Subscription Components

This directory contains all subscription-related UI components.

## Components

### `SubscriptionBadge`
Displays user's current tier and coin balance in the header navigation.

**Usage:**
```tsx
import { SubscriptionBadge } from '@/components/subscription';

<SubscriptionBadge />
```

### `InsufficientCoinsModal`
Modal shown when user doesn't have enough coins for an action.

**Usage:**
```tsx
import { InsufficientCoinsModal } from '@/components/subscription';

const [showModal, setShowModal] = useState(false);

<InsufficientCoinsModal
  isOpen={showModal}
  onClose={() => setShowModal(false)}
  required={1}
  available={0}
  currentTier="Free"
/>
```

### `FeatureLockedCard`
Card shown when a feature is locked behind a higher tier.

**Usage:**
```tsx
import { FeatureLockedCard } from '@/components/subscription';
import { TIER_CONFIGS } from '@/lib/subscription-types';

<FeatureLockedCard
  featureName="Test Cases"
  featureIcon="🧪"
  featureDescription="AI-powered test case generation"
  benefits={["Generate tests", "Auto-execute", "Track results"]}
  requiredTier={TIER_CONFIGS.tier_2}
  currentTier="Free"
/>
```

### `FeatureGuard`
Wrapper component that guards feature access. Shows locked card if user doesn't have access.

**Usage:**
```tsx
import { FeatureGuard } from '@/components/subscription';
import { Feature } from '@/lib/subscription-types';

<FeatureGuard feature={Feature.TEST_CASES}>
  <TestCasesComponent />
</FeatureGuard>
```

### `CoinCostIndicator`
Shows coin cost and balance for an action.

**Usage:**
```tsx
import { CoinCostIndicator } from '@/components/subscription';

<CoinCostIndicator cost={1} showWarning={true} />
```

## Hooks

All subscription hooks are located in `/lib/hooks/useSubscription.ts`:

- `useSubscription()` - Get full subscription details
- `useCoinBalance()` - Get coin balance only (lightweight)
- `useFeatureAccess(feature)` - Check if user has access to a feature
- `useTransactionHistory()` - Get transaction history
- `useUpgradeSubscription()` - Mutation for upgrading subscription

## Pages

- `/pricing` - Pricing comparison and upgrade page
- `/account/transactions` - Transaction history page

## Integration Example

```tsx
"use client";

import { useState } from "react";
import { useCoinBalance } from "@/lib/hooks/useSubscription";
import { InsufficientCoinsModal } from "@/components/subscription";
import { Button } from "@/components/ui/button";

export function ChatInput() {
  const { balance, refresh } = useCoinBalance();
  const [showModal, setShowModal] = useState(false);
  const COST_PER_MESSAGE = 1;

  const handleSend = async () => {
    if (balance < COST_PER_MESSAGE) {
      setShowModal(true);
      return;
    }

    // Send message...
    await sendChatMessage();

    // Refresh balance after successful send
    refresh();
  };

  return (
    <>
      <div>
        <CoinCostIndicator cost={COST_PER_MESSAGE} />
        <Button
          onClick={handleSend}
          disabled={balance < COST_PER_MESSAGE}
        >
          Send Message
        </Button>
      </div>

      <InsufficientCoinsModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        required={COST_PER_MESSAGE}
        available={balance}
      />
    </>
  );
}
```
