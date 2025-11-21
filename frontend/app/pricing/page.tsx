"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSubscription } from "@/lib/hooks/useSubscription";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2, Clock, Sparkles } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { openCashfreeCheckout } from "@/lib/cashfree";

interface CreditPackage {
  id: string;
  name: string;
  price: number;
  credits: number;
  currency: string;
  validity_days: number;
}

export default function PricingPage() {
  const router = useRouter();
  const { tier: currentTier, isLoading: subscriptionLoading } = useSubscription();
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoadingPackages, setIsLoadingPackages] = useState(true);

  // Fetch credit packages on mount
  useEffect(() => {
    const fetchPackages = async () => {
      try {
        const response = await api.getCreditPackages();
        setPackages(response.packages || []);
      } catch (error) {
        console.error("Failed to fetch credit packages:", error);
        toast.error("Failed to load credit packages");
      } finally {
        setIsLoadingPackages(false);
      }
    };

    fetchPackages();
  }, []);

  const handlePurchase = async (packageId: string) => {
    setSelectedPackage(packageId);
    setIsProcessing(true);

    try {
      // Step 1: Create payment order
      toast.loading("Initializing payment...");

      const orderData = await api.createPaymentOrder({
        package_id: packageId,
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
          setSelectedPackage(null);
        },
      });

    } catch (error: any) {
      console.error("Payment initiation failed:", error);
      toast.dismiss();

      if (error.message.includes("Email is required")) {
        toast.error("Please update your email in profile settings before purchasing.");
      } else if (error.message.includes("Phone number is required")) {
        toast.error("Please update your phone number in profile settings before purchasing.");
      } else {
        toast.error(error.message || "Failed to initiate payment. Please try again.");
      }

      setIsProcessing(false);
      setSelectedPackage(null);
    }
  };

  if (subscriptionLoading || isLoadingPackages) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Determine which package is recommended
  const recommendedPackageId = "standard";

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">
          Buy Credits
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          Purchase credits to access premium features. Credits are valid for 30 days.
        </p>
        {currentTier === "premium" && (
          <Badge className="mt-4 bg-purple-500 text-white">
            <Sparkles className="h-3 w-3 mr-1 inline" />
            Premium Active
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
        {packages.map((pkg) => {
          const isRecommended = pkg.id === recommendedPackageId;

          return (
            <Card
              key={pkg.id}
              className={`relative flex flex-col ${
                isRecommended
                  ? "border-2 border-purple-500 shadow-lg scale-105"
                  : "border border-gray-200 dark:border-gray-800"
              }`}
            >
              {isRecommended && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <Badge className="bg-purple-500 text-white px-4 py-1">
                    <Sparkles className="h-3 w-3 mr-1 inline" />
                    BEST VALUE
                  </Badge>
                </div>
              )}

              <CardHeader className="pb-4">
                <CardTitle className="text-2xl">{pkg.name}</CardTitle>
                <CardDescription className="text-sm">
                  {pkg.credits} credits for your projects
                </CardDescription>
              </CardHeader>

              <CardContent className="flex-1">
                <div className="mb-6">
                  <div>
                    <span className="text-4xl font-bold">${pkg.price}</span>
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    One-time purchase
                  </div>

                  <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg">
                    <div className="flex items-center gap-2 text-sm font-semibold text-amber-600 dark:text-amber-400">
                      <Clock className="h-4 w-4" />
                      {pkg.credits} credits
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      Valid for {pkg.validity_days} days
                    </div>
                  </div>
                </div>

                <ul className="space-y-3">
                  <li className="flex items-start gap-2 text-sm">
                    <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>All premium features</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm">
                    <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Deployment hosting</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm">
                    <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Test case generation</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm">
                    <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>VS Code access</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm">
                    <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Context harvesting</span>
                  </li>
                </ul>
              </CardContent>

              <CardFooter className="pt-4">
                <Button
                  onClick={() => handlePurchase(pkg.id)}
                  disabled={isProcessing && selectedPackage === pkg.id}
                  className={`w-full ${
                    isRecommended
                      ? "bg-purple-600 hover:bg-purple-700 text-white"
                      : ""
                  }`}
                  variant={isRecommended ? "default" : "outline"}
                >
                  {isProcessing && selectedPackage === pkg.id ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    "Buy Now"
                  )}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {/* Important Notice */}
      <div className="mt-12 max-w-3xl mx-auto space-y-4">
        <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <div className="text-2xl">ℹ️</div>
              <div>
                <h3 className="font-semibold mb-2">How Credits Work</h3>
                <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
                  <li>• Credits are valid for 30 days from purchase</li>
                  <li>• Premium tier is activated automatically when you have credits</li>
                  <li>• When credits expire, you'll be downgraded to the free tier</li>
                  <li>• You can purchase multiple packages - credits stack and each has its own 30-day validity</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <div className="text-2xl">💳</div>
              <div>
                <h3 className="font-semibold mb-2">Secure Payment Processing</h3>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Payments are processed securely via Cashfree Payment Gateway.
                  All transactions are encrypted and PCI DSS compliant. Your credits
                  will be allocated immediately after successful payment. For billing inquiries,
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
