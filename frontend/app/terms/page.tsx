"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollText } from "lucide-react";

export default function TermsPage() {
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-cyan-500/10 rounded-full">
              <ScrollText className="h-12 w-12 text-cyan-500" />
            </div>
          </div>
          <h1 className="text-4xl font-bold mb-4">Terms and Conditions</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        <Card>
          <CardContent className="pt-6 prose prose-sm dark:prose-invert max-w-none">
            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">1. Acceptance of Terms</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                By accessing and using Project Hub ("Service"), you accept and agree to be bound by the terms and provisions of this agreement. If you do not agree to these Terms and Conditions, please do not use our Service.
              </p>
            </section>

            <Separator className="my-6" />

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">2. Use License</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                Permission is granted to temporarily access and use the Service for personal or commercial use. This license does not include:
              </p>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 space-y-2 mb-4">
                <li>Modifying or copying the Service materials</li>
                <li>Using the materials for any commercial purpose without authorization</li>
                <li>Attempting to decompile or reverse engineer any software contained in the Service</li>
                <li>Removing any copyright or proprietary notations from the materials</li>
                <li>Transferring the materials to another person or "mirroring" the materials on any other server</li>
              </ul>
            </section>

            <Separator className="my-6" />

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">3. User Accounts</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                When you create an account with us, you must provide accurate, complete, and current information. Failure to do so constitutes a breach of the Terms, which may result in immediate termination of your account.
              </p>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                You are responsible for safeguarding the password and for all activities that occur under your account. You agree to notify us immediately of any unauthorized use of your account.
              </p>
            </section>

            <Separator className="my-6" />

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">4. Subscriptions and Payments</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                Some parts of the Service are billed on a subscription basis. You will be billed in advance on a recurring and periodic basis. Billing cycles are set on a monthly basis.
              </p>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                A valid payment method, including credit card or debit card, is required to process payments. You shall provide accurate and complete billing information including full name, address, zip code, and valid payment method information.
              </p>
            </section>

            <Separator className="my-6" />

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">5. Coin System</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                Project Hub uses a coin-based system for accessing certain features and services. Coins are allocated monthly based on your subscription tier and do not roll over to the next billing period unless otherwise specified.
              </p>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                Coins have no cash value and cannot be exchanged for money. Unused coins expire at the end of each billing period.
              </p>
            </section>

            <Separator className="my-6" />

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">6. Prohibited Uses</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                You may use the Service only for lawful purposes and in accordance with these Terms. You agree not to use the Service:
              </p>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 space-y-2 mb-4">
                <li>In any way that violates any applicable national or international law or regulation</li>
                <li>To transmit, or procure the sending of, any advertising or promotional material without our prior written consent</li>
                <li>To impersonate or attempt to impersonate the Company, a Company employee, another user, or any other person or entity</li>
                <li>In any way that infringes upon the rights of others, or in any way is illegal, threatening, fraudulent, or harmful</li>
                <li>To engage in any other conduct that restricts or inhibits anyone's use or enjoyment of the Service</li>
              </ul>
            </section>

            <Separator className="my-6" />

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">7. Intellectual Property</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                The Service and its original content (excluding Content provided by users), features, and functionality are and will remain the exclusive property of Project Hub and its licensors. The Service is protected by copyright, trademark, and other laws of both domestic and foreign countries.
              </p>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                You retain all rights to the content you create and upload to the Service. By uploading content, you grant us a worldwide, non-exclusive, royalty-free license to use, store, and display your content as necessary to provide the Service.
              </p>
            </section>

            <Separator className="my-6" />

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">8. Termination</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                We may terminate or suspend your account and bar access to the Service immediately, without prior notice or liability, under our sole discretion, for any reason whatsoever and without limitation, including but not limited to a breach of the Terms.
              </p>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                If you wish to terminate your account, you may simply discontinue using the Service or contact us to request account deletion.
              </p>
            </section>

            <Separator className="my-6" />

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">9. Limitation of Liability</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                In no event shall Project Hub, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential, or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from your access to or use of or inability to access or use the Service.
              </p>
            </section>

            <Separator className="my-6" />

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">10. Disclaimer</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                Your use of the Service is at your sole risk. The Service is provided on an "AS IS" and "AS AVAILABLE" basis. The Service is provided without warranties of any kind, whether express or implied, including, but not limited to, implied warranties of merchantability, fitness for a particular purpose, non-infringement, or course of performance.
              </p>
            </section>

            <Separator className="my-6" />

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">11. Governing Law</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                These Terms shall be governed and construed in accordance with the laws of the jurisdiction in which the Company is registered, without regard to its conflict of law provisions.
              </p>
            </section>

            <Separator className="my-6" />

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">12. Changes to Terms</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                We reserve the right, at our sole discretion, to modify or replace these Terms at any time. If a revision is material, we will provide at least 30 days' notice prior to any new terms taking effect. What constitutes a material change will be determined at our sole discretion.
              </p>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                By continuing to access or use our Service after any revisions become effective, you agree to be bound by the revised terms.
              </p>
            </section>

            <Separator className="my-6" />

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">13. Contact Us</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                If you have any questions about these Terms, please contact us at:
              </p>
              <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                <p className="text-gray-700 dark:text-gray-300 font-mono text-sm">
                  Email: support@projecthub.com<br />
                  Website: <a href="/contact" className="text-cyan-500 hover:underline">Contact Form</a>
                </p>
              </div>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
