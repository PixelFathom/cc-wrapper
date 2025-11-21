"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Loader2, AlertCircle, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import api from "@/lib/api";
import { formatCurrency } from "@/lib/cashfree";

export default function PaymentSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get("order_id");

  const [verificationStatus, setVerificationStatus] = useState<"loading" | "success" | "error">("loading");
  const [paymentDetails, setPaymentDetails] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    if (!orderId) {
      setVerificationStatus("error");
      setErrorMessage("No order ID provided");
      return;
    }

    verifyPayment();
  }, [orderId]);

  const verifyPayment = async () => {
    try {
      setVerificationStatus("loading");

      // Verify payment with backend
      const payment = await api.verifyPayment(orderId!);

      if (payment.status === "success") {
        setPaymentDetails(payment);
        setVerificationStatus("success");
      } else if (payment.status === "pending" || payment.status === "active") {
        // Payment still processing - retry after a delay
        setTimeout(() => {
          verifyPayment();
        }, 3000); // Retry every 3 seconds
      } else {
        // Payment failed or other status
        setVerificationStatus("error");
        setErrorMessage(payment.error_message || `Payment status: ${payment.status}`);
      }
    } catch (error: any) {
      console.error("Payment verification failed:", error);
      setVerificationStatus("error");
      setErrorMessage(error.message || "Failed to verify payment");
    }
  };

  if (!orderId) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto">
          <Card className="border-red-200 dark:border-red-800">
            <CardHeader>
              <div className="flex items-center gap-3">
                <AlertCircle className="h-8 w-8 text-red-500" />
                <CardTitle className="text-red-600 dark:text-red-400">
                  Invalid Payment Link
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                This payment link is invalid or expired. Please try again.
              </p>
              <Button onClick={() => router.push("/pricing")}>
                <ArrowRight className="h-4 w-4 mr-2" />
                View Pricing Plans
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (verificationStatus === "loading") {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardContent className="pt-12 pb-12">
              <div className="flex flex-col items-center justify-center space-y-4">
                <Loader2 className="h-16 w-16 animate-spin text-cyan-500" />
                <h2 className="text-2xl font-semibold">Verifying Payment...</h2>
                <p className="text-gray-600 dark:text-gray-400 text-center">
                  Please wait while we confirm your payment with our payment gateway.
                  This usually takes a few seconds.
                </p>
                <div className="text-sm text-muted-foreground mt-4">
                  Order ID: {orderId}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (verificationStatus === "error") {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto">
          <Card className="border-red-200 dark:border-red-800">
            <CardHeader>
              <div className="flex items-center gap-3">
                <AlertCircle className="h-8 w-8 text-red-500" />
                <CardTitle className="text-red-600 dark:text-red-400">
                  Payment Verification Failed
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                We couldn't verify your payment. This could mean:
              </p>
              <ul className="list-disc list-inside space-y-2 text-sm text-gray-600 dark:text-gray-400 mb-6">
                <li>The payment is still being processed by your bank</li>
                <li>The payment was declined</li>
                <li>There was a technical issue</li>
              </ul>
              {errorMessage && (
                <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
                  <p className="text-sm font-mono text-red-600 dark:text-red-400">
                    {errorMessage}
                  </p>
                </div>
              )}
              <div className="text-sm text-muted-foreground mb-6">
                Order ID: {orderId}
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => router.push("/account/transactions")}>
                  View Transactions
                </Button>
                <Button onClick={() => router.push("/pricing")}>
                  Try Again
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Success state
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-2xl mx-auto">
        <Card className="border-green-200 dark:border-green-800">
          <CardHeader>
            <div className="flex items-center gap-3">
              <CheckCircle className="h-12 w-12 text-green-500" />
              <div>
                <CardTitle className="text-green-600 dark:text-green-400 text-2xl">
                  Payment Successful!
                </CardTitle>
                <CardDescription>
                  Your subscription has been upgraded
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Payment Details */}
              <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <h3 className="font-semibold mb-3">Payment Details</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Amount Paid:</span>
                    <span className="font-semibold">
                      {formatCurrency(paymentDetails.amount, paymentDetails.currency)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Plan:</span>
                    <span className="font-semibold capitalize">
                      {paymentDetails.subscription_tier.replace("_", " ")}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Status:</span>
                    <Badge className="bg-green-500 text-white">
                      {paymentDetails.status.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Transaction ID:</span>
                    <span className="font-mono text-xs">
                      {paymentDetails.transaction_id || "Processing..."}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Order ID:</span>
                    <span className="font-mono text-xs">{paymentDetails.order_id}</span>
                  </div>
                </div>
              </div>

              {/* What's Next */}
              <div>
                <h3 className="font-semibold mb-3">What's Next?</h3>
                <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Your subscription has been activated immediately</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Coins have been added to your account</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>You'll receive a confirmation email shortly</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>View your transaction history anytime from your account</span>
                  </li>
                </ul>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={() => router.push("/account/transactions")}>
                  View Transactions
                </Button>
                <Button onClick={() => router.push("/")}>
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Go to Dashboard
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
