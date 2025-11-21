"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSubscription } from "@/lib/hooks/useSubscription";
import { SubscriptionTier, TIER_CONFIGS } from "@/lib/subscription-types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, X, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { openCashfreeCheckout } from "@/lib/cashfree";

export default function PricingPage() {
  const router = useRouter();
  const { tier: currentTier, isLoading: subscriptionLoading } = useSubscription();
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleUpgrade = async (tier: SubscriptionTier) => {
    if (tier === SubscriptionTier.TIER_3) {
      // For enterprise, redirect to contact sales
      toast.info("Redirecting to contact sales...");
      router.push("/contact");
      return;
    }

    if (tier === currentTier) {
      toast.info("You're already on this plan");
      return;
    }

    if (tier === SubscriptionTier.FREE) {
      // Downgrade to free - use cancel subscription flow
      toast.info("To downgrade to free tier, please cancel your subscription from your account settings.");
      return;
    }

    setSelectedTier(tier);
    setIsProcessing(true);

    try {
      // Step 1: Create payment order
      toast.loading("Initializing payment...");

      const orderData = await api.createPaymentOrder({
        tier: tier,
        return_url: `${window.location.origin}/payment/success`,
        cancel_url: `${window.location.origin}/payment/failure`,
      });

      // Clear loading toast
      toast.dismiss();
      toast.success("Opening payment checkout...");

      // Step 2: Open Cashfree checkout
      await openCashfreeCheckout({
        sessionId: orderData.payment_session_id,
        orderId: orderData.order_id,
        onSuccess: () => {
          // Payment successful - will be redirected to success page
          toast.success("Payment initiated successfully!");
        },
        onFailure: (error) => {
          // Payment failed
          toast.error(error.message || "Payment failed. Please try again.");
          setIsProcessing(false);
          setSelectedTier(null);
        },
      });

    } catch (error: any) {
      console.error("Payment initiation failed:", error);
      toast.dismiss();

      if (error.message.includes("Email is required")) {
        toast.error("Please update your email in profile settings before upgrading.");
      } else if (error.message.includes("Phone number is required")) {
        toast.error("Please update your phone number in profile settings before upgrading.");
      } else {
        toast.error(error.message || "Failed to initiate payment. Please try again.");
      }

      setIsProcessing(false);
      setSelectedTier(null);
    }
  };

  if (subscriptionLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">
          Choose Your Plan
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          Select the perfect plan for your needs. Upgrade or downgrade anytime.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
        {Object.entries(TIER_CONFIGS).map(([tierKey, config]) => {
          const tier = tierKey as SubscriptionTier;
          const isCurrentPlan = tier === currentTier;
          const isPopular = config.popular;

          return (
            <Card
              key={tier}
              className={`relative flex flex-col ${
                isPopular
                  ? "border-2 border-purple-500 shadow-lg scale-105"
                  : "border border-gray-200 dark:border-gray-800"
              } ${isCurrentPlan ? "bg-green-50 dark:bg-green-950/20" : ""}`}
            >
              {isPopular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <Badge className="bg-purple-500 text-white px-4 py-1">
                    <Sparkles className="h-3 w-3 mr-1 inline" />
                    MOST POPULAR
                  </Badge>
                </div>
              )}

              {isCurrentPlan && (
                <div className="absolute -top-4 right-4">
                  <Badge className="bg-green-500 text-white">
                    Current Plan
                  </Badge>
                </div>
              )}

              <CardHeader className="pb-4">
                <CardTitle className="text-2xl">{config.name}</CardTitle>
                <CardDescription className="text-sm h-10">
                  {config.description}
                </CardDescription>
              </CardHeader>

              <CardContent className="flex-1">
                <div className="mb-6">
                  {config.price === null ? (
                    <div>
                      <div className="text-3xl font-bold">Custom</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        Contact sales for pricing
                      </div>
                    </div>
                  ) : config.price === 0 ? (
                    <div>
                      <div className="text-4xl font-bold">Free</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        Forever
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div>
                        <span className="text-4xl font-bold">${config.price}</span>
                        <span className="text-gray-500 dark:text-gray-400">/month</span>
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Billed monthly
                      </div>
                    </div>
                  )}

                  <div className="mt-2 text-sm font-semibold text-amber-600 dark:text-amber-400">
                    {typeof config.coins === "number"
                      ? `${config.coins} coins/month`
                      : config.coins
                    }
                  </div>
                </div>

                <ul className="space-y-3">
                  {config.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm">
                      {feature.included ? (
                        <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      ) : (
                        <X className="h-4 w-4 text-gray-300 dark:text-gray-700 mt-0.5 flex-shrink-0" />
                      )}
                      <span
                        className={
                          !feature.included
                            ? "text-gray-400 dark:text-gray-600"
                            : ""
                        }
                      >
                        {feature.name}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>

              <CardFooter className="pt-4">
                {isCurrentPlan ? (
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled
                  >
                    Current Plan
                  </Button>
                ) : (
                  <Button
                    onClick={() => handleUpgrade(tier)}
                    disabled={isProcessing && selectedTier === tier}
                    className={`w-full ${
                      isPopular
                        ? "bg-purple-600 hover:bg-purple-700 text-white"
                        : ""
                    }`}
                    variant={isPopular ? "default" : "outline"}
                  >
                    {isProcessing && selectedTier === tier ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : config.price === null ? (
                      "Contact Sales"
                    ) : (
                      "Select Plan"
                    )}
                  </Button>
                )}
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {/* Payment Integration Notice */}
      <div className="mt-12 max-w-3xl mx-auto">
        <Card className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <div className="text-2xl">💳</div>
              <div>
                <h3 className="font-semibold mb-2">Secure Payment Processing</h3>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Payments are processed securely via Cashfree Payment Gateway.
                  All transactions are encrypted and PCI DSS compliant. Your subscription
                  will be activated immediately after successful payment. For billing inquiries,
                  please contact support.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
