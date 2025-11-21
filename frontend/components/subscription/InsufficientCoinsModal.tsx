"use client";

import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Coins } from "lucide-react";

interface InsufficientCoinsModalProps {
  isOpen: boolean;
  onClose: () => void;
  required: number;
  available: number;
  currentTier?: string;
}

export function InsufficientCoinsModal({
  isOpen,
  onClose,
  required,
  available,
  currentTier = "Free",
}: InsufficientCoinsModalProps) {
  const router = useRouter();

  const handleUpgrade = () => {
    onClose();
    router.push("/pricing");
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
              <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
            </div>
          </div>
          <DialogTitle className="text-center text-xl">
            Insufficient Coins
          </DialogTitle>
          <DialogDescription className="text-center pt-2">
            You need <span className="font-semibold">{required} coin{required > 1 ? "s" : ""}</span> to send this message.
          </DialogDescription>
        </DialogHeader>

        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 my-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Current Balance:
            </span>
            <div className="flex items-center gap-1">
              <Coins className="h-4 w-4 text-amber-600" />
              <span className="font-semibold">{available}</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Current Plan:
            </span>
            <span className="font-semibold">{currentTier}</span>
          </div>
        </div>

        <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3">
          <p className="text-sm text-purple-900 dark:text-purple-100 text-center">
            💡 Upgrade your plan to get more coins and unlock premium features!
          </p>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            onClick={handleUpgrade}
            className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700"
          >
            View Plans
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
