"use client";

import { useCoinBalance } from "@/lib/hooks/useSubscription";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface CreditCostProps {
  cost: number;
  /**
   * Display variant:
   * - "badge": Compact badge for inline/button use (🪙 1)
   * - "badge-subtle": Subtle badge for inside colored buttons
   * - "inline": Inline text with cost (consumes 1 credit)
   * - "full": Full display with balance after
   * - "context": Shows remaining balance below an action
   */
  variant?: "badge" | "badge-subtle" | "inline" | "full" | "context";
  className?: string;
  showWarning?: boolean;
  size?: "sm" | "md" | "lg";
}

/**
 * Versatile credit cost indicator component
 * Can be used inline in buttons, as badges, or as full cost displays
 */
export function CreditCost({
  cost,
  variant = "badge",
  className,
  showWarning = true,
  size = "sm",
}: CreditCostProps) {
  const { balance, isLoading } = useCoinBalance();
  const balanceAfter = balance - cost;
  const insufficient = balanceAfter < 0;
  const lowBalance = balanceAfter >= 0 && balanceAfter < 5;

  const getBalanceColor = () => {
    if (insufficient) return "text-red-500";
    if (lowBalance) return "text-yellow-500";
    return "text-green-500";
  };

  const sizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  };

  // Badge variant - compact, for inside buttons
  if (variant === "badge") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md",
          "bg-amber-500/20 text-amber-400 border border-amber-500/30",
          sizeClasses[size],
          className
        )}
      >
        <CoinIcon className="h-3 w-3" />
        <span className="font-medium">{cost}</span>
      </span>
    );
  }

  // Badge-subtle variant - for inside colored buttons (no background, just text)
  if (variant === "badge-subtle") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 px-1.5 py-0.5 rounded",
          "bg-black/30 text-white font-medium",
          sizeClasses[size],
          className
        )}
      >
        <CoinIconFilled className="h-3.5 w-3.5 text-yellow-400" />
        <span>{cost}</span>
      </span>
    );
  }

  // Inline variant - simple text
  if (variant === "inline") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1",
          "text-amber-400",
          sizeClasses[size],
          className
        )}
      >
        <CoinIcon className="h-3 w-3" />
        <span>
          {cost} credit{cost !== 1 ? "s" : ""}
        </span>
      </span>
    );
  }

  // Context variant - shows remaining balance
  if (variant === "context") {
    if (isLoading) {
      return (
        <div className={cn("flex items-center gap-2", sizeClasses[size], className)}>
          <span className="text-muted-foreground">Loading balance...</span>
        </div>
      );
    }

    return (
      <div className={cn("flex flex-col gap-1", sizeClasses[size], className)}>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-amber-400">
            <CoinIcon className="h-3 w-3" />
            <span>{cost} credit{cost !== 1 ? "s" : ""}</span>
          </span>
          <span className="text-muted-foreground">•</span>
          <span className={cn("flex items-center gap-1", getBalanceColor())}>
            <span>{balance} remaining</span>
          </span>
        </div>
        {insufficient && showWarning && (
          <div className="flex items-center gap-1 text-red-400">
            <WarningIcon className="h-3 w-3" />
            <span>
              Insufficient credits.{" "}
              <Link href="/pricing" className="underline hover:text-red-300">
                Get more
              </Link>
            </span>
          </div>
        )}
      </div>
    );
  }

  // Full variant - detailed display
  return (
    <div className={cn("space-y-2", sizeClasses[size], className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <CoinIcon className="h-3.5 w-3.5 text-amber-400" />
          <span>
            Cost: {cost} credit{cost !== 1 ? "s" : ""}
          </span>
        </div>
        {!isLoading && (
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">After:</span>
            <span className={cn("font-semibold", getBalanceColor())}>
              {balanceAfter} <CoinIcon className="inline h-3 w-3" />
            </span>
          </div>
        )}
      </div>

      {insufficient && showWarning && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
          <WarningIcon className="h-4 w-4 flex-shrink-0" />
          <span>
            Insufficient credits.{" "}
            <Link href="/pricing" className="underline font-semibold hover:text-red-300">
              Upgrade your plan
            </Link>
          </span>
        </div>
      )}
    </div>
  );
}

// Simple coin icon component (outline)
function CoinIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v8" />
      <path d="M9 11h6" />
    </svg>
  );
}

// Filled coin icon component (for buttons)
function CoinIconFilled({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
    >
      {/* Outer coin circle */}
      <circle cx="12" cy="12" r="10" fill="currentColor" />
      {/* Inner ring for depth */}
      <circle cx="12" cy="12" r="7.5" fill="none" stroke="#00000030" strokeWidth="1" />
      {/* C letter for Credit/Coin */}
      <path
        d="M14.5 9.5C13.8 8.6 12.9 8 11.8 8C9.7 8 8 9.8 8 12C8 14.2 9.7 16 11.8 16C12.9 16 13.8 15.4 14.5 14.5"
        stroke="#000000"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

// Warning icon component
function WarningIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

export default CreditCost;
