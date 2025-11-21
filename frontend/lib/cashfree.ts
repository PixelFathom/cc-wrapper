/**
 * Cashfree Payment Gateway Integration
 * Using official @cashfreepayments/cashfree-js package
 * Documentation: https://github.com/cashfree/cashfree-js
 */

import { load } from '@cashfreepayments/cashfree-js';

// Get Cashfree environment from env variable
const CASHFREE_ENV = (process.env.NEXT_PUBLIC_CASHFREE_ENV || "sandbox") as "sandbox" | "production";

/**
 * Cashfree instance (cached)
 */
let cashfreeInstance: any = null;

/**
 * Initialize Cashfree SDK
 * Loads the Cashfree SDK and returns the instance
 */
export async function initializeCashfree() {
  try {
    console.log(`Initializing Cashfree SDK in ${CASHFREE_ENV} mode...`);

    // Return cached instance if available
    if (cashfreeInstance) {
      console.log("Using cached Cashfree instance");
      return cashfreeInstance;
    }

    // Load Cashfree SDK
    cashfreeInstance = await load({
      mode: CASHFREE_ENV
    });

    if (!cashfreeInstance) {
      throw new Error("Failed to load Cashfree SDK");
    }

    console.log("Cashfree SDK loaded successfully");
    return cashfreeInstance;

  } catch (error) {
    console.error("Failed to initialize Cashfree SDK:", error);
    throw new Error("Failed to initialize payment gateway. Please try again.");
  }
}

/**
 * Open Cashfree checkout for payment
 *
 * @param sessionId - Payment session ID from backend
 * @param orderId - Order ID from backend
 * @param onSuccess - Optional callback for payment success
 * @param onFailure - Optional callback for payment failure
 */
export async function openCashfreeCheckout({
  sessionId,
  orderId,
  onSuccess,
  onFailure,
}: {
  sessionId: string;
  orderId: string;
  onSuccess?: (data: any) => void;
  onFailure?: (data: any) => void;
}) {
  try {
    console.log("Opening Cashfree checkout...");
    console.log("Order ID:", orderId);
    console.log("Session ID:", sessionId.substring(0, 20) + "...");

    // Initialize Cashfree
    const cashfree = await initializeCashfree();

    if (!cashfree) {
      throw new Error("Cashfree SDK not initialized");
    }

    // Configure checkout options
    const checkoutOptions = {
      paymentSessionId: sessionId,
      returnUrl: `${window.location.origin}/payment/success?order_id=${orderId}`,
      redirectTarget: "_self" as const, // Open in same tab
    };

    console.log("Checkout options:", {
      ...checkoutOptions,
      paymentSessionId: sessionId.substring(0, 20) + "..."
    });

    // Call checkout - this will redirect to Cashfree portal
    const result = await cashfree.checkout(checkoutOptions);

    console.log("Checkout result:", result);

    // Handle result
    if (result?.error) {
      console.error("Cashfree checkout error:", result.error);

      if (onFailure) {
        onFailure(result.error);
      } else {
        // Default error handling - redirect to failure page
        window.location.href = `/payment/failure?order_id=${orderId}&error=${encodeURIComponent(result.error.message || "Payment failed")}`;
      }
      return;
    }

    // If we have payment details, payment was completed
    if (result?.paymentDetails) {
      console.log("Payment completed:", result.paymentDetails);

      if (onSuccess) {
        onSuccess(result.paymentDetails);
      } else {
        // Default success handling - redirect to success page
        window.location.href = `/payment/success?order_id=${orderId}`;
      }
      return;
    }

    // If redirect is indicated, the SDK will handle it automatically
    if (result?.redirect) {
      console.log("Redirecting to Cashfree payment portal...");
      // No action needed - SDK handles the redirect
    }

  } catch (error: any) {
    console.error("Failed to open Cashfree checkout:", error);

    if (onFailure) {
      onFailure({ message: error.message || "Failed to open checkout" });
    } else {
      // Rethrow to be caught by the calling code
      throw error;
    }
  }
}

/**
 * Check if Cashfree is properly configured
 */
export function isCashfreeConfigured(): boolean {
  return !!process.env.NEXT_PUBLIC_CASHFREE_ENV;
}

/**
 * Get Cashfree environment
 */
export function getCashfreeEnvironment(): string {
  return CASHFREE_ENV;
}

/**
 * Validate order ID format
 */
export function isValidOrderId(orderId: string): boolean {
  return orderId.startsWith("ORDER_") && orderId.length > 10;
}

/**
 * Format currency amount for display
 */
export function formatCurrency(amount: number, currency: string = "INR"): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currency,
  }).format(amount);
}

/**
 * Get payment status badge color
 */
export function getPaymentStatusColor(status: string): string {
  const statusColors: Record<string, string> = {
    pending: "bg-yellow-500",
    active: "bg-blue-500",
    success: "bg-green-500",
    failed: "bg-red-500",
    cancelled: "bg-gray-500",
    expired: "bg-gray-400",
    refunded: "bg-purple-500",
  };

  return statusColors[status.toLowerCase()] || "bg-gray-500";
}

/**
 * Get payment status label
 */
export function getPaymentStatusLabel(status: string): string {
  const statusLabels: Record<string, string> = {
    pending: "Pending",
    active: "In Progress",
    success: "Successful",
    failed: "Failed",
    cancelled: "Cancelled",
    expired: "Expired",
    refunded: "Refunded",
  };

  return statusLabels[status.toLowerCase()] || status;
}
