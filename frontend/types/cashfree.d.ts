/**
 * Type declarations for @cashfreepayments/cashfree-js
 */

declare module '@cashfreepayments/cashfree-js' {
  export interface CashfreeLoadOptions {
    mode: 'sandbox' | 'production';
  }

  export interface CheckoutOptions {
    paymentSessionId: string;
    returnUrl?: string;
    redirectTarget?: '_self' | '_blank' | '_parent' | '_top';
  }

  export interface CheckoutResult {
    error?: {
      message: string;
      code?: string;
    };
    paymentDetails?: any;
    redirect?: boolean;
  }

  export interface CashfreeInstance {
    checkout(options: CheckoutOptions): Promise<CheckoutResult>;
  }

  export function load(options: CashfreeLoadOptions): Promise<CashfreeInstance | null>;
}
