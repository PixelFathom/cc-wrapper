"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useCoinBalance } from "@/lib/hooks/useSubscription";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { CoinCostIndicator } from "@/components/subscription/CoinCostIndicator";
import { toast } from "sonner";
import { Loader2, GitBranch, GitCommit, Coins } from "lucide-react";

interface CommitAndPushModalProps {
  taskId: string;
  taskName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const COMMIT_PUSH_COST = 1;

export function CommitAndPushModal({
  taskId,
  taskName,
  open,
  onOpenChange,
}: CommitAndPushModalProps) {
  const { balance, refresh: refreshBalance } = useCoinBalance();
  const queryClient = useQueryClient();

  const [branchName, setBranchName] = useState("");
  const [commitMessage, setCommitMessage] = useState("");
  const [createNewBranch, setCreateNewBranch] = useState(true);

  const commitAndPushMutation = useMutation({
    mutationFn: async () => {
      if (!branchName.trim()) {
        throw new Error("Branch name is required");
      }
      if (!commitMessage.trim()) {
        throw new Error("Commit message is required");
      }

      return api.commitAndPushChanges(taskId, {
        branch_name: branchName.trim(),
        commit_message: commitMessage.trim(),
        create_new_branch: createNewBranch,
      });
    },
    onSuccess: (data) => {
      toast.success("Commit and push initiated successfully!", {
        description: `Your changes are being committed to branch "${branchName}". ${data.coins_remaining} coins remaining.`,
      });

      // Refresh coin balance
      refreshBalance();

      // Refresh deployment hooks to show the commit and push progress
      queryClient.invalidateQueries({ queryKey: ["deployment-hooks", taskId] });

      // Reset form
      setBranchName("");
      setCommitMessage("");
      setCreateNewBranch(true);

      // Close modal
      onOpenChange(false);
    },
    onError: (error: any) => {
      console.error("Failed to commit and push:", error);

      const errorMessage = error?.responseData?.detail || error?.message || "Failed to commit and push changes";

      if (error?.status === 402) {
        toast.error("Insufficient coins", {
          description: "Please upgrade your plan to use this premium feature.",
          action: {
            label: "Upgrade",
            onClick: () => window.location.href = "/pricing",
          },
        });
      } else {
        toast.error("Commit and push failed", {
          description: errorMessage,
        });
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    commitAndPushMutation.mutate();
  };

  const insufficient = balance < COMMIT_PUSH_COST;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitCommit className="h-5 w-5" />
            Commit and Push Changes
          </DialogTitle>
          <DialogDescription>
            Commit and push your changes to a Git branch. This is a premium feature.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* Coin Cost Indicator */}
            <CoinCostIndicator cost={COMMIT_PUSH_COST} />

            {/* Branch Name */}
            <div className="space-y-2">
              <Label htmlFor="branch-name" className="flex items-center gap-1.5">
                <GitBranch className="h-4 w-4" />
                Branch Name
              </Label>
              <Input
                id="branch-name"
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
                placeholder={`feature/${taskName.toLowerCase().replace(/\s+/g, "-")}`}
                required
                disabled={commitAndPushMutation.isPending}
              />
              <p className="text-xs text-muted-foreground">
                The branch where your changes will be committed
              </p>
            </div>

            {/* Create New Branch Checkbox */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="create-new-branch"
                checked={createNewBranch}
                onCheckedChange={(checked) => setCreateNewBranch(checked as boolean)}
                disabled={commitAndPushMutation.isPending}
              />
              <Label
                htmlFor="create-new-branch"
                className="text-sm font-normal cursor-pointer"
              >
                Create new branch if it doesn't exist
              </Label>
            </div>

            {/* Commit Message */}
            <div className="space-y-2">
              <Label htmlFor="commit-message">Commit Message</Label>
              <Textarea
                id="commit-message"
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                placeholder={`Add implementation for ${taskName}`}
                rows={4}
                required
                disabled={commitAndPushMutation.isPending}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Describe what changes you've made
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={commitAndPushMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                commitAndPushMutation.isPending ||
                insufficient ||
                !branchName.trim() ||
                !commitMessage.trim()
              }
            >
              {commitAndPushMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Committing...
                </>
              ) : (
                <>
                  <Coins className="mr-2 h-4 w-4" />
                  Commit & Push ({COMMIT_PUSH_COST} coin)
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
