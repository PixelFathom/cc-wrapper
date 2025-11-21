"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Lock, Check } from "lucide-react";
import { TierConfig } from "@/lib/subscription-types";

interface FeatureLockedCardProps {
  featureName: string;
  featureIcon: string;
  featureDescription: string;
  benefits: string[];
  requiredTier: TierConfig;
  currentTier: string;
}

export function FeatureLockedCard({
  featureName,
  featureIcon,
  featureDescription,
  benefits,
  requiredTier,
  currentTier,
}: FeatureLockedCardProps) {
  const router = useRouter();

  return (
    <Card className="border-2 border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
      <CardHeader className="text-center pb-4">
        <div className="flex justify-center mb-4">
          <div className="relative">
            <div className="text-6xl">{featureIcon}</div>
            <div className="absolute -bottom-1 -right-1 bg-gray-900 dark:bg-gray-100 rounded-full p-1.5">
              <Lock className="h-4 w-4 text-white dark:text-gray-900" />
            </div>
          </div>
        </div>

        <h3 className="text-2xl font-bold mb-2">{featureName}</h3>
        <p className="text-gray-600 dark:text-gray-400 text-sm">
          {featureDescription}
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <h4 className="font-semibold mb-3 text-sm">What you'll get:</h4>
          <ul className="space-y-2">
            {benefits.map((benefit, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm">
                <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700 dark:text-gray-300">
                  {benefit}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex justify-between items-center text-sm bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
          <div>
            <span className="text-gray-500 dark:text-gray-400">Current: </span>
            <span className="font-semibold">{currentTier}</span>
          </div>
          <div className="text-right">
            <span className="text-gray-500 dark:text-gray-400">Required: </span>
            <span className="font-semibold text-purple-600 dark:text-purple-400">
              {requiredTier.name}
              {requiredTier.price && ` ($${requiredTier.price}/mo)`}
            </span>
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex gap-3 justify-center pt-2">
        <Button
          onClick={() => router.push("/pricing")}
          className="bg-purple-600 hover:bg-purple-700 text-white"
          size="lg"
        >
          Upgrade Now
        </Button>
        <Button
          variant="outline"
          onClick={() => router.push("/pricing")}
          size="lg"
        >
          Compare Plans
        </Button>
      </CardFooter>
    </Card>
  );
}
