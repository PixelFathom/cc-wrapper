"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { XCircle, RefreshCw, ArrowLeft, HelpCircle } from "lucide-react";
import Link from "next/link";

function PaymentFailureContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get("order_id");
  const error = searchParams.get("error");

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-2xl mx-auto">
        <Card className="border-red-200 dark:border-red-800">
          <CardHeader>
            <div className="flex items-center gap-3">
              <XCircle className="h-12 w-12 text-red-500" />
              <div>
                <CardTitle className="text-red-600 dark:text-red-400 text-2xl">
                  Payment Failed
                </CardTitle>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Your payment could not be processed
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Error Details */}
              {error && (
                <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <h3 className="font-semibold text-red-600 dark:text-red-400 mb-2">
                    Error Details
                  </h3>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    {decodeURIComponent(error)}
                  </p>
                </div>
              )}

              {orderId && (
                <div className="text-sm text-muted-foreground">
                  <span className="font-semibold">Order ID:</span>{" "}
                  <span className="font-mono">{orderId}</span>
                </div>
              )}

              {/* Common Reasons */}
              <div>
                <h3 className="font-semibold mb-3">Common Reasons for Payment Failure</h3>
                <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-2 flex-shrink-0" />
                    <span>Insufficient funds in your account</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-2 flex-shrink-0" />
                    <span>Incorrect card details or CVV</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-2 flex-shrink-0" />
                    <span>Card expired or blocked</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-2 flex-shrink-0" />
                    <span>Transaction declined by your bank</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-2 flex-shrink-0" />
                    <span>Network or connectivity issues</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-2 flex-shrink-0" />
                    <span>Payment cancelled by user</span>
                  </li>
                </ul>
              </div>

              {/* What to Do Next */}
              <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4">
                <h3 className="font-semibold mb-3">What to Do Next?</h3>
                <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                  <li className="flex items-start gap-2">
                    <span className="text-cyan-500 font-bold">1.</span>
                    <span>Check your card details and ensure you have sufficient funds</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-cyan-500 font-bold">2.</span>
                    <span>Try using a different payment method (different card or UPI)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-cyan-500 font-bold">3.</span>
                    <span>Contact your bank if the issue persists</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-cyan-500 font-bold">4.</span>
                    <span>
                      If you believe this is an error, contact our support team
                    </span>
                  </li>
                </ul>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <Button
                  onClick={() => router.push("/pricing")}
                  className="flex-1"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
                <Button
                  variant="outline"
                  onClick={() => router.push("/")}
                  className="flex-1"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </Button>
              </div>

              {/* Help Section */}
              <div className="border-t border-gray-200 dark:border-gray-800 pt-6">
                <div className="flex items-start gap-3">
                  <HelpCircle className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-sm mb-1">Need Help?</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      If you're having trouble with payment, our support team is here to help.
                    </p>
                    <Link href="/contact">
                      <Button variant="link" className="p-0 h-auto">
                        Contact Support
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>

              {/* No Charges Notice */}
              <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  <strong>Important:</strong> No charges have been made to your account.
                  Failed transactions are automatically voided and won't appear on your statement.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function PaymentFailurePage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-2xl mx-auto">
            <Card className="border-red-200 dark:border-red-800">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <XCircle className="h-12 w-12 text-red-500" />
                  <div>
                    <CardTitle className="text-red-600 dark:text-red-400 text-2xl">
                      Payment Failed
                    </CardTitle>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Loading details...
                    </p>
                  </div>
                </div>
              </CardHeader>
            </Card>
          </div>
        </div>
      }
    >
      <PaymentFailureContent />
    </Suspense>
  );
}
