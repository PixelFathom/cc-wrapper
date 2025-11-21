"use client";

import Link from "next/link";
import { CodeIcon } from "@radix-ui/react-icons";
import { Separator } from "./ui/separator";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-border mt-auto">
      <div className="container mx-auto px-4 sm:px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-1 md:col-span-1">
            <Link href="/" className="flex items-center space-x-2 mb-4">
              <div className="flex items-center space-x-2 bg-card px-3 py-1.5 rounded-lg border border-border">
                <CodeIcon className="h-5 w-5 text-cyan-500" />
                <span className="font-mono text-sm">
                  <span className="text-muted-foreground">$</span>
                  <span className="text-cyan-500 ml-1">project-hub</span>
                </span>
              </div>
            </Link>
            <p className="text-sm text-muted-foreground">
              Elegant project management with real-time collaboration
            </p>
          </div>

          {/* Product */}
          <div>
            <h3 className="font-semibold mb-4 text-sm">Product</h3>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/"
                  className="text-sm text-muted-foreground hover:text-cyan-500 transition-colors"
                >
                  Features
                </Link>
              </li>
              <li>
                <Link
                  href="/pricing"
                  className="text-sm text-muted-foreground hover:text-cyan-500 transition-colors"
                >
                  Pricing
                </Link>
              </li>
              <li>
                <Link
                  href="/account/transactions"
                  className="text-sm text-muted-foreground hover:text-cyan-500 transition-colors"
                >
                  Account
                </Link>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="font-semibold mb-4 text-sm">Support</h3>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/contact"
                  className="text-sm text-muted-foreground hover:text-cyan-500 transition-colors"
                >
                  Contact Us
                </Link>
              </li>
              <li>
                <a
                  href="mailto:support@projecthub.com"
                  className="text-sm text-muted-foreground hover:text-cyan-500 transition-colors"
                >
                  Email Support
                </a>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="font-semibold mb-4 text-sm">Legal</h3>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/terms"
                  className="text-sm text-muted-foreground hover:text-cyan-500 transition-colors"
                >
                  Terms & Conditions
                </Link>
              </li>
              <li>
                <Link
                  href="/refund-policy"
                  className="text-sm text-muted-foreground hover:text-cyan-500 transition-colors"
                >
                  Refund Policy
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <Separator className="my-6" />

        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-muted-foreground">
            &copy; {currentYear} Project Hub. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <span className="text-xs text-muted-foreground font-mono">v1.0.0</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
