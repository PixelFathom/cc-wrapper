"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { RefreshCcw, AlertCircle, Clock, CheckCircle } from "lucide-react";

export default function RefundPolicyPage() {
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-purple-500/10 rounded-full">
              <RefreshCcw className="h-12 w-12 text-purple-500" />
            </div>
          </div>
          <h1 className="text-4xl font-bold mb-4">Refund and Cancellation Policy</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {/* Quick Overview */}
        <Card className="mb-8 bg-gradient-to-br from-purple-50 to-cyan-50 dark:from-purple-950/20 dark:to-cyan-950/20 border-purple-200 dark:border-purple-800">
          <CardContent className="pt-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-purple-500" />
              Quick Overview
            </h2>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                <span>7-day money-back guarantee for all paid plans</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                <span>Cancel your subscription anytime without penalties</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                <span>Prorated refunds available in certain circumstances</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                <span>Refunds processed within 5-10 business days</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 prose prose-sm dark:prose-invert max-w-none">
            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
                1. Subscription Cancellation
                <Badge variant="outline" className="ml-2">Important</Badge>
              </h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                You can cancel your subscription at any time through your account settings. When you cancel:
              </p>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 space-y-2 mb-4">
                <li>Your subscription will remain active until the end of your current billing period</li>
                <li>You will continue to have access to all paid features until the subscription expires</li>
                <li>No further charges will be made to your payment method</li>
                <li>Your account will automatically downgrade to the Free tier after the current period ends</li>
                <li>All your data will be preserved, but features will be limited to the Free tier</li>
              </ul>

              <div className="bg-cyan-50 dark:bg-cyan-950/20 border border-cyan-200 dark:border-cyan-800 rounded-lg p-4 my-4">
                <div className="flex items-start gap-3">
                  <Clock className="h-5 w-5 text-cyan-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                      How to Cancel
                    </p>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      Navigate to Account Settings &rarr; Subscription &rarr; Cancel Subscription.
                      Follow the prompts to complete the cancellation process.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <Separator className="my-6" />

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">2. Refund Eligibility</h2>

              <h3 className="text-xl font-semibold mb-3 mt-6">2.1 7-Day Money-Back Guarantee</h3>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                We offer a 7-day money-back guarantee for all paid subscription plans. If you are not satisfied with the Service for any reason, you may request a full refund within 7 days of your initial subscription purchase.
              </p>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                To qualify for the money-back guarantee:
              </p>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 space-y-2 mb-4">
                <li>You must be a first-time subscriber (new customer)</li>
                <li>The request must be made within 7 days of the initial subscription purchase</li>
                <li>The refund applies only to the first billing cycle</li>
                <li>Your account must not have violated our Terms of Service</li>
              </ul>

              <h3 className="text-xl font-semibold mb-3 mt-6">2.2 Service Issues and Downtime</h3>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                If you experience significant service disruptions or downtime that prevents you from using the Service, you may be eligible for a prorated refund. This is determined on a case-by-case basis depending on:
              </p>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 space-y-2 mb-4">
                <li>The duration of the service disruption</li>
                <li>The impact on your ability to use core features</li>
                <li>Whether the issue was reported to our support team in a timely manner</li>
              </ul>

              <h3 className="text-xl font-semibold mb-3 mt-6">2.3 Ineligible Refund Requests</h3>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                The following situations are not eligible for refunds:
              </p>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 space-y-2 mb-4">
                <li>Refund requests made after the 7-day money-back guarantee period (unless due to service issues)</li>
                <li>Change of mind after the 7-day period</li>
                <li>Lack of use or failure to cancel before the renewal date</li>
                <li>Accounts terminated for Terms of Service violations</li>
                <li>Used coins or consumed resources (coins cannot be refunded once used)</li>
                <li>Subscription renewals (only the initial purchase is covered by the money-back guarantee)</li>
              </ul>
            </section>

            <Separator className="my-6" />

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">3. Coin System and Refunds</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                Our coin system operates on a monthly allocation basis:
              </p>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 space-y-2 mb-4">
                <li><strong>Unused Coins:</strong> Coins do not roll over between billing periods and expire at the end of each month</li>
                <li><strong>No Cash Value:</strong> Coins have no cash value and cannot be exchanged for money</li>
                <li><strong>Refund Impact:</strong> If you receive a refund, any coins used during the billing period will be deducted from the refund amount at the rate of the subscription tier</li>
                <li><strong>Cancellation:</strong> When you cancel, any remaining coins for the current period remain available until the subscription expires</li>
              </ul>
            </section>

            <Separator className="my-6" />

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">4. How to Request a Refund</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                To request a refund, please follow these steps:
              </p>
              <ol className="list-decimal pl-6 text-gray-700 dark:text-gray-300 space-y-3 mb-4">
                <li>
                  <strong>Contact Support:</strong> Send an email to support@tediux.com with the subject line "Refund Request"
                </li>
                <li>
                  <strong>Provide Information:</strong> Include your account email, subscription details, and reason for the refund request
                </li>
                <li>
                  <strong>Wait for Review:</strong> Our team will review your request within 2-3 business days
                </li>
                <li>
                  <strong>Receive Decision:</strong> You will be notified via email about the approval or denial of your refund request
                </li>
                <li>
                  <strong>Processing Time:</strong> If approved, refunds are processed within 5-10 business days to your original payment method
                </li>
              </ol>

              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 my-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                      Important Note
                    </p>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      Please allow up to 10 business days for the refund to appear in your account after approval.
                      Processing times may vary depending on your payment provider.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <Separator className="my-6" />

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">5. Subscription Changes and Downgrades</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                If you change your subscription plan during a billing cycle:
              </p>

              <h3 className="text-lg font-semibold mb-2 mt-4">Upgrading</h3>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 space-y-2 mb-4">
                <li>When you upgrade to a higher-tier plan, you will be charged the prorated difference immediately</li>
                <li>Your new plan features and coin allocation take effect immediately</li>
                <li>Your billing date remains the same</li>
              </ul>

              <h3 className="text-lg font-semibold mb-2 mt-4">Downgrading</h3>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 space-y-2 mb-4">
                <li>When you downgrade to a lower-tier plan, the change takes effect at the end of your current billing cycle</li>
                <li>You continue to have access to your current plan features until the billing cycle ends</li>
                <li>No refunds are issued for the difference when downgrading</li>
                <li>Unused coins from the higher tier do not carry over to the lower tier</li>
              </ul>
            </section>

            <Separator className="my-6" />

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">6. Free Trial Policy</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                If we offer a free trial period for certain plans:
              </p>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 space-y-2 mb-4">
                <li>You can cancel at any time during the trial period without being charged</li>
                <li>If you do not cancel before the trial ends, you will be automatically charged for the subscription</li>
                <li>The 7-day money-back guarantee begins after the trial period ends and you are charged</li>
                <li>One free trial per customer</li>
              </ul>
            </section>

            <Separator className="my-6" />

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">7. Payment Method Changes</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                You can update your payment method at any time through your account settings. If a payment fails:
              </p>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 space-y-2 mb-4">
                <li>We will attempt to process the payment multiple times over a grace period</li>
                <li>You will receive email notifications about failed payment attempts</li>
                <li>If payment is not received within the grace period, your subscription will be downgraded to the Free tier</li>
                <li>No refunds are issued for partial months when payment fails</li>
              </ul>
            </section>

            <Separator className="my-6" />

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">8. Data Retention After Cancellation</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                When you cancel your subscription or are downgraded to the Free tier:
              </p>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 space-y-2 mb-4">
                <li>Your data is preserved and accessible according to the Free tier limits</li>
                <li>Data exceeding Free tier limits may be archived but not deleted</li>
                <li>You can request complete account deletion at any time</li>
                <li>Once an account is deleted, data cannot be recovered</li>
              </ul>
            </section>

            <Separator className="my-6" />

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">9. Contact Us</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                If you have any questions about our Refund and Cancellation Policy, please contact us:
              </p>
              <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                <p className="text-gray-700 dark:text-gray-300 font-mono text-sm">
                  Email: support@tediux.com<br />
                  Subject: Refund Request or Cancellation Question<br />
                  Website: <a href="/contact" className="text-cyan-500 hover:underline">Contact Form</a>
                </p>
              </div>
            </section>

            <Separator className="my-6" />

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">10. Changes to This Policy</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                We reserve the right to modify this Refund and Cancellation Policy at any time. Changes will be effective immediately upon posting to our website. Your continued use of the Service after any changes constitutes acceptance of the new policy.
              </p>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                We will make reasonable efforts to notify you of material changes to this policy via email or through the Service.
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
