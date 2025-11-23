"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { CheckCircledIcon, UpdateIcon } from "@radix-ui/react-icons";
import { Loader2, Github } from "lucide-react";
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
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoadingPackages, setIsLoadingPackages] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentTier, setCurrentTier] = useState<string | null>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('github_user');
    const authStatus = !!storedUser;
    setIsAuthenticated(authStatus);

    if (authStatus) {
      const fetchSubscription = async () => {
        try {
          const response = await api.getSubscription();
          setCurrentTier(response.subscription_tier);
        } catch (error) {
          console.error('Failed to fetch subscription:', error);
        }
      };
      fetchSubscription();
    }
  }, []);

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
      if (!isAuthenticated) {
        toast.error("Please log in with GitHub to purchase credits");
        setIsProcessing(false);
        setSelectedPackage(null);
        return;
      }

      toast.loading("Checking profile...");
      const validation = await api.validatePaymentRequirements();

      if (!validation.valid) {
        toast.dismiss();
        toast.error(validation.message);
        setTimeout(() => router.push("/profile"), 2000);
        setIsProcessing(false);
        setSelectedPackage(null);
        return;
      }

      toast.loading("Initializing payment...");
      const orderData = await api.createPaymentOrder({
        package_id: packageId,
        return_url: `${window.location.origin}/payment/success`,
        cancel_url: `${window.location.origin}/payment/failure`,
      });

      toast.dismiss();
      toast.success("Opening payment checkout...");

      await openCashfreeCheckout({
        sessionId: orderData.payment_session_id,
        orderId: orderData.order_id,
        onSuccess: () => {
          toast.success("Payment initiated successfully!");
        },
        onFailure: (error) => {
          toast.error(error.message || "Payment failed. Please try again.");
          setIsProcessing(false);
          setSelectedPackage(null);
        },
      });
    } catch (error: any) {
      console.error("Payment initiation failed:", error);
      toast.dismiss();

      if (error.message.includes("Email is required") || error.message.includes("Phone number is required")) {
        toast.error("Please update your profile with email and phone number to proceed.");
        setTimeout(() => router.push("/profile"), 2000);
      } else if (error.message.includes("not authenticated")) {
        toast.error("Please log in with GitHub to purchase credits");
      } else {
        toast.error(error.message || "Failed to initiate payment. Please try again.");
      }

      setIsProcessing(false);
      setSelectedPackage(null);
    }
  };

  const recommendedPackageId = "standard";

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6">
      <div className="container mx-auto max-w-6xl">
        {/* Terminal Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-12"
        >
          <div className="terminal-bg rounded-lg border border-border p-4 max-w-xl">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex gap-1.5">
                <span className="w-3 h-3 rounded-full bg-red-500/80" />
                <span className="w-3 h-3 rounded-full bg-yellow-500/80" />
                <span className="w-3 h-3 rounded-full bg-green-500/80" />
              </div>
              <span className="text-xs font-mono text-muted-foreground ml-2">~/pricing</span>
            </div>
            <div className="font-mono text-sm">
              <span className="text-green-400">➜</span>
              <span className="text-cyan-400 ml-2">tediux</span>
              <span className="text-muted-foreground ml-2">credits --packages</span>
            </div>
          </div>

          <div className="mt-6">
            <h1 className="text-3xl font-bold text-foreground mb-2">Buy Credits</h1>
            <p className="text-muted-foreground">
              Credits power AI queries, deployments, and hosting. Valid for 30 days.
            </p>
            {isAuthenticated && currentTier === "premium" && (
              <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-cyan-500/15 text-cyan-400 text-sm font-mono">
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
                Premium Active
              </div>
            )}
          </div>
        </motion.div>

        {/* Loading State */}
        {isLoadingPackages ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex items-center gap-3 text-muted-foreground font-mono">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Loading packages...</span>
            </div>
          </div>
        ) : (
          <>
            {/* Credit Packages Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-12">
              {packages.map((pkg, index) => {
                const isRecommended = pkg.id === recommendedPackageId;
                const isSelected = selectedPackage === pkg.id && isProcessing;

                return (
                  <motion.div
                    key={pkg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: index * 0.05 }}
                    className={`relative ${isRecommended ? 'sm:-mt-2 sm:mb-2' : ''}`}
                  >
                    {isRecommended && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-cyan-500 text-black">
                          Best Value
                        </span>
                      </div>
                    )}

                    <div className={`h-full flex flex-col rounded-lg border bg-card/50 transition-all duration-200 ${
                      isRecommended
                        ? 'border-cyan-500/50 shadow-lg shadow-cyan-500/10'
                        : 'border-border/50 hover:border-cyan-500/30'
                    }`}>
                      {/* Header */}
                      <div className={`px-4 py-4 border-b ${isRecommended ? 'border-cyan-500/30' : 'border-border/30'}`}>
                        <div className="font-mono text-sm text-muted-foreground mb-1">{pkg.name}</div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl font-bold text-foreground">
                            {pkg.currency === 'INR' ? '₹' : '$'}{pkg.price}
                          </span>
                        </div>
                        <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-1 rounded bg-cyan-500/10 text-cyan-400 text-xs font-mono">
                          <span>{pkg.credits} credits</span>
                        </div>
                      </div>

                      {/* Features */}
                      <div className="flex-1 px-4 py-4">
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <CheckCircledIcon className="h-3.5 w-3.5 text-green-500 shrink-0" />
                            <span>Valid {pkg.validity_days} days</span>
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <CheckCircledIcon className="h-3.5 w-3.5 text-green-500 shrink-0" />
                            <span>AI queries</span>
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <CheckCircledIcon className="h-3.5 w-3.5 text-green-500 shrink-0" />
                            <span>Deployments</span>
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <CheckCircledIcon className="h-3.5 w-3.5 text-green-500 shrink-0" />
                            <span>Cloud hosting</span>
                          </div>
                        </div>
                      </div>

                      {/* CTA */}
                      <div className="px-4 pb-4">
                        <Button
                          onClick={() => handlePurchase(pkg.id)}
                          disabled={isSelected}
                          className={`w-full ${
                            isRecommended
                              ? 'bg-cyan-500 hover:bg-cyan-600 text-black'
                              : 'bg-transparent border border-border hover:border-cyan-500/50 hover:bg-cyan-500/10 text-foreground'
                          }`}
                          size="sm"
                        >
                          {isSelected ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Processing...
                            </>
                          ) : !isAuthenticated ? (
                            <>
                              <Github className="h-4 w-4 mr-2" />
                              Sign in
                            </>
                          ) : (
                            'Buy Now'
                          )}
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Info Sections */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto">
              {/* How Credits Work */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.3 }}
                className="bg-card/30 rounded-lg border border-border/50 p-5"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-md bg-cyan-500/10 text-cyan-400">
                    <UpdateIcon className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-medium text-foreground mb-2">How Credits Work</h3>
                    <ul className="text-sm text-muted-foreground space-y-1.5">
                      <li className="flex items-start gap-2">
                        <span className="text-cyan-400">•</span>
                        <span>Valid for 30 days from purchase</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-cyan-400">•</span>
                        <span>Premium tier activates with credits</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-cyan-400">•</span>
                        <span>Credits stack across purchases</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </motion.div>

              {/* Secure Payment */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.4 }}
                className="bg-card/30 rounded-lg border border-border/50 p-5"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-md bg-green-500/10 text-green-400">
                    <CheckCircledIcon className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-medium text-foreground mb-2">Secure Payment</h3>
                    <p className="text-sm text-muted-foreground">
                      Payments processed securely via Cashfree. All transactions are encrypted and PCI DSS compliant. Credits allocated immediately.
                    </p>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Terminal Footer */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="mt-8 text-center"
            >
              <div className="inline-flex items-center gap-2 font-mono text-sm text-muted-foreground">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                <span>Secure checkout ready</span>
              </div>
            </motion.div>
          </>
        )}
      </div>
    </div>
  );
}
