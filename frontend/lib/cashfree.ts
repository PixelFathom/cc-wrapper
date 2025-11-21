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
 * Uses Cashfree Drop SDK for seamless checkout experience
 *
 * @param sessionId - Payment session ID from backend
 * @param orderId - Order ID from backend
 * @param onSuccess - Callback function on payment success
 * @param onFailure - Callback function on payment failure
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
    // Try to use SDK if available, otherwise fall back to redirect
    if (window.Cashfree) {
      console.log("Using Cashfree SDK for checkout");

      const cashfree = await initializeCashfree();

      const checkoutOptions = {
        paymentSessionId: sessionId,
        returnUrl: `${window.location.origin}/payment/success?order_id=${orderId}`,
      };

      cashfree.checkout(checkoutOptions).then((result: any) => {
        if (result.error) {
          console.error("Cashfree checkout error:", result.error);
          if (onFailure) {
            onFailure(result.error);
          } else {
            window.location.href = `/payment/failure?order_id=${orderId}&error=${encodeURIComponent(result.error.message || "Payment failed")}`;
          }
        }

        if (result.redirect) {
          console.log("Payment redirect initiated");
        }

        if (result.paymentDetails) {
          console.log("Payment completed:", result.paymentDetails);
          if (onSuccess) {
            onSuccess(result.paymentDetails);
          } else {
            window.location.href = `/payment/success?order_id=${orderId}`;
          }
        }
      });
    } else {
      // Fallback: Use Cashfree's hosted checkout page (redirect)
      console.log("Cashfree SDK not available, using hosted checkout redirect");

      const returnUrl = `${window.location.origin}/payment/success?order_id=${orderId}`;

      // Use Cashfree's hosted checkout page
      const hostedCheckoutUrl = CASHFREE_ENV === "production"
        ? `https://payments.cashfree.com/order/pay`
        : `https://payments-test.cashfree.com/order/pay`;

      // Create a form to POST the session ID to Cashfree
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = hostedCheckoutUrl;

      const sessionInput = document.createElement('input');
      sessionInput.type = 'hidden';
      sessionInput.name = 'payment_session_id';
      sessionInput.value = sessionId;
      form.appendChild(sessionInput);

      const returnUrlInput = document.createElement('input');
      returnUrlInput.type = 'hidden';
      returnUrlInput.name = 'return_url';
      returnUrlInput.value = returnUrl;
      form.appendChild(returnUrlInput);

      document.body.appendChild(form);
      form.submit();
    }
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
