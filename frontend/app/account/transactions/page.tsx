"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useTransactionHistory, useSubscription } from "@/lib/hooks/useSubscription";
import { TransactionType } from "@/lib/subscription-types";
import { Button } from "@/components/ui/button";
import {
  CheckCircledIcon,
  CrossCircledIcon,
  UpdateIcon,
  ExternalLinkIcon,
  MinusIcon,
  PlusIcon
} from "@radix-ui/react-icons";
import { format } from "date-fns";
import Link from "next/link";

/**
 * Helper function to generate navigation link for a transaction
 */
function getTransactionLink(transaction: any): string | null {
  const { reference_type, reference_id, metadata } = transaction;

  if (reference_type === "chat" && reference_id && metadata?.session_id) {
    const projectId = metadata.project_id;
    const taskId = metadata.task_id_ref;
    if (projectId && taskId) {
      return `/p/${projectId}/t/${taskId}?session=${metadata.session_id}&highlight=${reference_id}`;
    }
    return null;
  }

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
  if (metadata.project_name) parts.push(metadata.project_name);
  if (metadata.task_name) parts.push(metadata.task_name);

  return parts.length > 0 ? parts.join(" / ") : null;
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

  // Loading state
  if (!mounted || isLoading) {
    return (
      <div className="min-h-screen py-12 px-4 sm:px-6">
        <div className="container mx-auto max-w-4xl">
          <div className="terminal-bg rounded-lg border border-border p-4 max-w-md mb-8">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex gap-1.5">
                <span className="w-3 h-3 rounded-full bg-red-500/80" />
                <span className="w-3 h-3 rounded-full bg-yellow-500/80" />
                <span className="w-3 h-3 rounded-full bg-green-500/80" />
              </div>
              <span className="text-xs font-mono text-muted-foreground ml-2">~/transactions</span>
            </div>
            <div className="font-mono text-sm flex items-center gap-2">
              <UpdateIcon className="h-4 w-4 animate-spin text-cyan-400" />
              <span className="text-muted-foreground">Loading transactions...</span>
            </div>
          </div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-card/30 rounded-lg border border-border/30 animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen py-12 px-4 sm:px-6">
        <div className="container mx-auto max-w-4xl">
          <div className="terminal-bg rounded-lg border border-red-500/30 p-6">
            <div className="flex items-center gap-2 text-red-400 font-mono text-sm mb-2">
              <CrossCircledIcon className="h-4 w-4" />
              <span>Authentication required</span>
            </div>
            <p className="text-muted-foreground text-sm">
              Please log in with GitHub to view your transaction history.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (transactionsError || subscriptionError) {
    return (
      <div className="min-h-screen py-12 px-4 sm:px-6">
        <div className="container mx-auto max-w-4xl">
          <div className="terminal-bg rounded-lg border border-red-500/30 p-6">
            <div className="flex items-center gap-2 text-red-400 font-mono text-sm mb-2">
              <CrossCircledIcon className="h-4 w-4" />
              <span>Error loading data</span>
            </div>
            <p className="text-muted-foreground text-sm mb-4">
              {transactionsError?.toString() || subscriptionError?.toString() || "Failed to load data"}
            </p>
            <Button
              onClick={() => window.location.reload()}
              variant="outline"
              size="sm"
              className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10"
            >
              Reload Page
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6">
      <div className="container mx-auto max-w-4xl">
        {/* Terminal Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-8"
        >
          <div className="terminal-bg rounded-lg border border-border p-4 max-w-md">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex gap-1.5">
                <span className="w-3 h-3 rounded-full bg-red-500/80" />
                <span className="w-3 h-3 rounded-full bg-yellow-500/80" />
                <span className="w-3 h-3 rounded-full bg-green-500/80" />
              </div>
              <span className="text-xs font-mono text-muted-foreground ml-2">~/account/transactions</span>
            </div>
            <div className="font-mono text-sm">
              <span className="text-green-400">➜</span>
              <span className="text-cyan-400 ml-2">tediux</span>
              <span className="text-muted-foreground ml-2">credits --history</span>
            </div>
          </div>

          <div className="mt-6">
            <h1 className="text-2xl font-bold text-foreground mb-1">Transaction History</h1>
            <p className="text-muted-foreground text-sm">Credit usage and allocation log</p>
          </div>
        </motion.div>

        {/* Stats Row */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="grid grid-cols-3 gap-4 mb-8"
        >
          <div className="bg-card/50 rounded-lg border border-border/50 p-4">
            <div className="text-xs text-muted-foreground font-mono mb-1">balance</div>
            <div className="text-2xl font-bold text-cyan-400 font-mono">
              {subscription?.coins_balance || 0}
            </div>
          </div>
          <div className="bg-card/50 rounded-lg border border-border/50 p-4">
            <div className="text-xs text-muted-foreground font-mono mb-1">allocated</div>
            <div className="text-2xl font-bold text-green-400 font-mono">
              +{subscription?.coins_total_allocated || 0}
            </div>
          </div>
          <div className="bg-card/50 rounded-lg border border-border/50 p-4">
            <div className="text-xs text-muted-foreground font-mono mb-1">used</div>
            <div className="text-2xl font-bold text-red-400 font-mono">
              -{subscription?.coins_total_used || 0}
            </div>
          </div>
        </motion.div>

        {/* Transactions List */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-mono text-muted-foreground">
              {transactions.length} transactions
            </h2>
          </div>

          {transactions.length === 0 ? (
            <div className="bg-card/30 rounded-lg border border-border/50 p-12 text-center">
              <div className="text-muted-foreground font-mono text-sm">
                <span className="text-cyan-400">~</span> No transactions yet
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {transactions.map((transaction, index) => {
                const isPositive = transaction.amount > 0;
                const navLink = getTransactionLink(transaction);
                const metadataDesc = getMetadataDescription(transaction);

                return (
                  <motion.div
                    key={transaction.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.02 }}
                    className="group bg-card/30 hover:bg-card/50 rounded-lg border border-border/40 hover:border-cyan-500/20 transition-all duration-200"
                  >
                    <div className="flex items-center justify-between p-4">
                      {/* Left: Icon + Details */}
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className={`p-1.5 rounded-md ${isPositive ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                          {isPositive ? (
                            <PlusIcon className="h-4 w-4 text-green-400" />
                          ) : (
                            <MinusIcon className="h-4 w-4 text-red-400" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm text-foreground">{transaction.description}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                              transaction.transaction_type === TransactionType.ALLOCATION
                                ? 'bg-green-500/10 text-green-400'
                                : transaction.transaction_type === TransactionType.USAGE
                                  ? 'bg-red-500/10 text-red-400'
                                  : 'bg-muted text-muted-foreground'
                            }`}>
                              {transaction.transaction_type}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            <span className="font-mono">
                              {format(new Date(transaction.created_at), "MMM d, HH:mm")}
                            </span>
                            {metadataDesc && (
                              <>
                                <span className="text-border">•</span>
                                <span className="truncate">{metadataDesc}</span>
                              </>
                            )}
                          </div>

                          {navLink && (
                            <Link href={navLink} className="inline-flex items-center gap-1 mt-2 text-xs text-cyan-400 hover:text-cyan-300">
                              <ExternalLinkIcon className="h-3 w-3" />
                              <span>View {transaction.reference_type}</span>
                            </Link>
                          )}
                        </div>
                      </div>

                      {/* Right: Amount */}
                      <div className="text-right ml-4 shrink-0">
                        <div className={`text-lg font-bold font-mono ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                          {isPositive ? '+' : ''}{transaction.amount}
                        </div>
                        <div className="text-[10px] text-muted-foreground font-mono">
                          bal: {transaction.balance_after}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* Footer Status */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-8 text-center"
        >
          <div className="inline-flex items-center gap-2 font-mono text-sm text-muted-foreground">
            <CheckCircledIcon className="h-4 w-4 text-green-500" />
            <span>Transaction log complete</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
