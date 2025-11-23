"use client";

import { useCoinBalance } from "@/lib/hooks/useSubscription";
import { Coins, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Link from "next/link";

interface CoinCostIndicatorProps {
  cost: number;
  showWarning?: boolean;
}

/**
 * Component to show coin cost and balance for an action
 */
export function CoinCostIndicator({ cost, showWarning = true }: CoinCostIndicatorProps) {
  const { balance } = useCoinBalance();
  const balanceAfter = balance - cost;
  const insufficient = balanceAfter < 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
          <Coins className="h-3.5 w-3.5" />
          <span>Cost: {cost} coin{cost !== 1 ? "s" : ""}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-gray-600 dark:text-gray-400">Balance after:</span>
          <span className={`font-semibold ${insufficient ? "text-red-600" : "text-amber-600"}`}>
            {balanceAfter} 🪙
          </span>
        </div>
      </div>

      {insufficient && showWarning && (
        <Alert variant="destructive" className="py-2">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            Insufficient coins.{" "}
            <Link href="/pricing" className="underline font-semibold">
              Upgrade your plan
            </Link>{" "}
            to continue.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
