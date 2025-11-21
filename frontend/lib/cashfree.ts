/**
 * Cashfree Payment Gateway Integration Utilities
 * Handles Cashfree checkout initialization and payment processing
 */

// Get Cashfree environment from env variable
const CASHFREE_ENV = process.env.NEXT_PUBLIC_CASHFREE_ENV || "sandbox";

// Cashfree SDK type declaration
declare global {
  interface Window {
    Cashfree: any;
  }
}

/**
 * Initialize Cashfree SDK
 * Must be called before using any Cashfree functions
 * The SDK script is loaded via Next.js Script component in layout.tsx
 */
export async function initializeCashfree() {
  try {
    // Wait for Cashfree to be available (with retry logic)
    let retries = 0;
    const maxRetries = 10;

    while (!window.Cashfree && retries < maxRetries) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      retries++;
    }

    // Check if Cashfree is available
    if (!window.Cashfree) {
      throw new Error("Cashfree SDK not available. Please refresh the page.");
    }

    // Initialize Cashfree with environment
    const cashfree = window.Cashfree({
      mode: CASHFREE_ENV as "sandbox" | "production",
    });

    return cashfree;
  } catch (error) {
    console.error("Failed to initialize Cashfree SDK:", error);
    throw new Error("Failed to initialize payment gateway");
  }
}

/**
 * Open Cashfree checkout for payment
 * Uses redirect-based flow which works without JavaScript SDK
 *
 * @param sessionId - Payment session ID from backend
 * @param orderId - Order ID from backend
 * @param onSuccess - Callback function on payment success (not used in redirect flow)
 * @param onFailure - Callback function on payment failure (not used in redirect flow)
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
    // Use Cashfree's redirect-based payment flow
    // This doesn't require the JavaScript SDK and works reliably across all environments
    const returnUrl = `${window.location.origin}/payment/success?order_id=${orderId}`;

    // Construct Cashfree payment URL
    const paymentUrl = CASHFREE_ENV === "production"
      ? `https://payments.cashfree.com/order/#/checkout?order_token=${sessionId}`
      : `https://payments-test.cashfree.com/order/#/checkout?order_token=${sessionId}`;

    // Add return URL as query parameter
    const fullPaymentUrl = `${paymentUrl}&return_url=${encodeURIComponent(returnUrl)}`;

    // Log for debugging
    console.log("Redirecting to Cashfree payment page:", {
      orderId,
      sessionId,
      environment: CASHFREE_ENV
    });

    // Redirect to Cashfree payment page
    window.location.href = fullPaymentUrl;

  } catch (error) {
    console.error("Failed to open Cashfree checkout:", error);
    throw error;
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
export function formatCurrency(amount: number, currency: string = "USD"): string {
  return new Intl.NumberFormat("en-US", {
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
