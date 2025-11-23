"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { GitCommit, Clock } from "lucide-react";

interface CommitAndPushModalProps {
  taskId: string;
  taskName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommitAndPushModal({
  taskId,
  taskName,
  open,
  onOpenChange,
}: CommitAndPushModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitCommit className="h-5 w-5" />
            Commit and Push Changes
          </DialogTitle>
          <DialogDescription>
            Push your changes directly to a Git branch.
          </DialogDescription>
        </DialogHeader>

        <div className="py-8 flex flex-col items-center justify-center text-center space-y-4">
          <div className="p-4 rounded-full bg-amber-100 dark:bg-amber-900/30">
            <Clock className="h-10 w-10 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Releasing Soon</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              We're working hard to bring you this feature. Stay tuned for updates!
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
