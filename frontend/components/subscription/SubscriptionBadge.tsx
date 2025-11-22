"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useCoinBalance } from "@/lib/hooks/useSubscription";
import { SubscriptionTier } from "@/lib/subscription-types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Coins, Crown, ChevronDown, History, CreditCard } from "lucide-react";

const TIER_COLORS = {
  [SubscriptionTier.FREE]: "bg-gray-500",
  [SubscriptionTier.PREMIUM]: "bg-gradient-to-r from-purple-500 to-pink-500",
};

const TIER_NAMES = {
  [SubscriptionTier.FREE]: "Free",
  [SubscriptionTier.PREMIUM]: "Premium",
};

export function SubscriptionBadge() {
  const { balance, tier, isLoading } = useCoinBalance();
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const checkAuth = () => {
      try {
        setIsAuthenticated(!!localStorage.getItem("github_user"));
      } catch (error) {
        console.error("Failed to read auth status from storage", error);
        setIsAuthenticated(false);
      }
    };

    checkAuth();
    setMounted(true);

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === "github_user") {
        checkAuth();
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  // Don't render anything until we've checked auth status
  if (!mounted) {
    return null;
  }

  if (!isAuthenticated) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-full" />
        <div className="h-8 w-20 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-full" />
      </div>
    );
  }

  const tierKey = tier as SubscriptionTier;
  const tierColor = TIER_COLORS[tierKey] || TIER_COLORS[SubscriptionTier.FREE];
  const tierName = TIER_NAMES[tierKey] || "Free";
  const showUpgradeOption = tierKey === SubscriptionTier.FREE; // Show upgrade only for free users

  return (
    <div className="flex items-center gap-2">
      {/* Coin Balance Display */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 dark:bg-amber-950 rounded-full border border-amber-200 dark:border-amber-800">
        <Coins className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        <span className="font-semibold text-sm text-amber-900 dark:text-amber-100">
          {balance}
        </span>
      </div>

      {/* Tier Badge with Dropdown */}
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className={`${tierColor} text-white hover:opacity-90 transition-opacity px-3 py-1.5 h-auto rounded-full text-sm font-medium`}
          >
            <Crown className="h-3.5 w-3.5 mr-1.5" />
            {tierName}
            <ChevronDown className="h-3.5 w-3.5 ml-1" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <div className="flex flex-col">
              <span className="text-sm font-semibold">{tierName} Plan</span>
              <span className="text-xs text-gray-500 font-normal">
                {balance} coin{balance !== 1 ? "s" : ""} remaining
              </span>
            </div>
          </DropdownMenuLabel>

          <DropdownMenuSeparator />

          <DropdownMenuItem asChild>
            <Link
              href="/account/transactions"
              className="flex items-center cursor-pointer"
              onClick={() => setIsOpen(false)}
            >
              <History className="h-4 w-4 mr-2" />
              Transaction History
            </Link>
          </DropdownMenuItem>

          {showUpgradeOption && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link
                  href="/pricing"
                  className="flex items-center cursor-pointer text-purple-600 dark:text-purple-400 font-medium"
                  onClick={() => setIsOpen(false)}
                >
                  <CreditCard className="h-4 w-4 mr-2" />
                  Buy Credits
                </Link>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
