"use client";

import { useEffect, useState } from "react";
import { useTransactionHistory, useSubscription } from "@/lib/hooks/useSubscription";
import { TransactionType } from "@/lib/subscription-types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Coins, TrendingUp, TrendingDown, RefreshCw, Settings, Zap, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";
import { useRouter } from "next/navigation";

const TRANSACTION_ICONS = {
  [TransactionType.ALLOCATION]: TrendingUp,
  [TransactionType.USAGE]: TrendingDown,
  [TransactionType.REFUND]: RefreshCw,
  [TransactionType.ADJUSTMENT]: Settings,
  [TransactionType.EXPIRY]: Zap,
};

const TRANSACTION_COLORS = {
  [TransactionType.ALLOCATION]: "text-green-600 dark:text-green-400",
  [TransactionType.USAGE]: "text-red-600 dark:text-red-400",
  [TransactionType.REFUND]: "text-blue-600 dark:text-blue-400",
  [TransactionType.ADJUSTMENT]: "text-purple-600 dark:text-purple-400",
  [TransactionType.EXPIRY]: "text-gray-600 dark:text-gray-400",
};

const TRANSACTION_BG = {
  [TransactionType.ALLOCATION]: "bg-green-50 dark:bg-green-950/20",
  [TransactionType.USAGE]: "bg-red-50 dark:bg-red-950/20",
  [TransactionType.REFUND]: "bg-blue-50 dark:bg-blue-950/20",
  [TransactionType.ADJUSTMENT]: "bg-purple-50 dark:bg-purple-950/20",
  [TransactionType.EXPIRY]: "bg-gray-50 dark:bg-gray-950/20",
};

/**
 * Helper function to generate navigation link for a transaction
 */
function getTransactionLink(transaction: any): string | null {
  const { reference_type, reference_id, metadata } = transaction;

  // For chat usage, navigate to the chat session
  if (reference_type === "chat" && reference_id && metadata?.session_id) {
    // Use project_id and task_id_ref from metadata
    const projectId = metadata.project_id;
    const taskId = metadata.task_id_ref;

    if (projectId && taskId) {
      return `/p/${projectId}/t/${taskId}?session=${metadata.session_id}&highlight=${reference_id}`;
    }

    // Fallback: Can't navigate without project/task IDs
    return null;
  }

  // For task-related transactions
  if (reference_type === "task" && reference_id && metadata?.project_id) {
    return `/p/${metadata.project_id}/t/${reference_id}`;
  }

  return null;
}

/**
 * Helper to get readable description of transaction metadata
 */
function getMetadataDescription(transaction: any): string | null {
  const { metadata } = transaction;

  if (!metadata) return null;

  const parts: string[] = [];

  if (metadata.project_name) {
    parts.push(`Project: ${metadata.project_name}`);
  }

  if (metadata.task_name) {
    parts.push(`Task: ${metadata.task_name}`);
  }

  if (metadata.prompt_length) {
    parts.push(`Message length: ${metadata.prompt_length} chars`);
  }

  return parts.length > 0 ? parts.join(" • ") : null;
}

export default function TransactionsPage() {
  const { transactions, isLoading, error: transactionsError } = useTransactionHistory();
  const { subscription, error: subscriptionError } = useSubscription();
  const [mounted, setMounted] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    setMounted(true);
    setIsAuthenticated(!!localStorage.getItem('github_user'));
  }, []);

  // Show loading during SSR and initial mount
  if (!mounted) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Skeleton className="h-10 w-64 mb-6" />
        <Skeleton className="h-32 w-full mb-4" />
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="border-red-200 dark:border-red-800">
          <CardHeader>
            <CardTitle className="text-red-600 dark:text-red-400">Authentication Required</CardTitle>
            <CardDescription>
              Please log in with GitHub to view your transaction history.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Skeleton className="h-10 w-64 mb-6" />
        <Skeleton className="h-32 w-full mb-4" />
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (transactionsError || subscriptionError) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="border-red-200 dark:border-red-800">
          <CardHeader>
            <CardTitle className="text-red-600 dark:text-red-400">Error Loading Data</CardTitle>
            <CardDescription>
              {transactionsError?.toString() || subscriptionError?.toString() || "Failed to load subscription data"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => window.location.reload()}>
              Reload Page
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Transaction History</h1>
        <p className="text-gray-600 dark:text-gray-400">
          View all your coin transactions and usage history
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Current Balance</CardDescription>
            <CardTitle className="text-3xl flex items-center gap-2">
              <Coins className="h-6 w-6 text-amber-600" />
              {subscription?.coins_balance || 0}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Allocated</CardDescription>
            <CardTitle className="text-3xl text-green-600 dark:text-green-400">
              +{subscription?.coins_total_allocated || 0}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Used</CardDescription>
            <CardTitle className="text-3xl text-red-600 dark:text-red-400">
              -{subscription?.coins_total_used || 0}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Transactions List */}
      <Card>
        <CardHeader>
          <CardTitle>All Transactions</CardTitle>
          <CardDescription>
            Complete history of all coin transactions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <Coins className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No transactions yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.map((transaction) => {
                const Icon = TRANSACTION_ICONS[transaction.transaction_type];
                const colorClass = TRANSACTION_COLORS[transaction.transaction_type];
                const bgClass = TRANSACTION_BG[transaction.transaction_type];
                const navLink = getTransactionLink(transaction);
                const metadataDesc = getMetadataDescription(transaction);

                return (
                  <div
                    key={transaction.id}
                    className={`flex items-center justify-between p-4 rounded-lg border ${bgClass}`}
                  >
                    <div className="flex items-start gap-3 flex-1">
                      <div className={`p-2 rounded-full ${bgClass}`}>
                        <Icon className={`h-5 w-5 ${colorClass}`} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <p className="font-medium text-sm">
                            {transaction.description}
                          </p>
                          <Badge variant="outline" className="text-xs">
                            {transaction.transaction_type}
                          </Badge>
                        </div>

                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {format(new Date(transaction.created_at), "PPp")}
                        </p>

                        {metadataDesc && (
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                            {metadataDesc}
                          </p>
                        )}

                        {transaction.reference_type && (
                          <div className="flex items-center gap-2 mt-2">
                            {navLink ? (
                              <Link href={navLink}>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2 text-xs"
                                >
                                  <ExternalLink className="h-3 w-3 mr-1" />
                                  View {transaction.reference_type}
                                </Button>
                              </Link>
                            ) : (
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                Related to: {transaction.reference_type}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="text-right ml-4">
                      <div
                        className={`text-lg font-bold ${
                          transaction.amount > 0
                            ? "text-green-600 dark:text-green-400"
                            : "text-red-600 dark:text-red-400"
                        }`}
                      >
                        {transaction.amount > 0 ? "+" : ""}
                        {transaction.amount}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Balance: {transaction.balance_after}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
