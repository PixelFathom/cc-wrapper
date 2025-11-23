"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useCoinBalance } from "@/lib/hooks/useSubscription";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Coins, History, CreditCard, ChevronDown } from "lucide-react";

export function SubscriptionBadge() {
  const { balance, isLoading } = useCoinBalance();
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
      <div className="h-8 w-20 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-full" />
    );
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 dark:bg-amber-950 rounded-full border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900 transition-colors cursor-pointer">
          <Coins className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <span className="font-semibold text-sm text-amber-900 dark:text-amber-100">
            {balance}
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">Credits</span>
            <span className="text-xs text-gray-500 font-normal">
              {balance} credit{balance !== 1 ? "s" : ""} remaining
            </span>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link
            href="/pricing"
            className="flex items-center cursor-pointer text-emerald-600 dark:text-emerald-400 font-medium"
            onClick={() => setIsOpen(false)}
          >
            <CreditCard className="h-4 w-4 mr-2" />
            Buy More Credits
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem asChild>
          <Link
            href="/account/transactions"
            className="flex items-center cursor-pointer"
            onClick={() => setIsOpen(false)}
          >
            <History className="h-4 w-4 mr-2" />
            View Transaction History
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
