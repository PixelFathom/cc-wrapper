import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Script from 'next/script'
import './globals.css'
import { Providers } from '@/components/providers'
import { Navigation } from '@/components/navigation'
import { Footer } from '@/components/footer'
import { ApprovalCenter } from '@/components/approval-center'
import { Toaster } from 'sonner'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Project Hub - Elegant Project Management',
  description: 'A sophisticated project management platform with real-time collaboration',
}

// Get Cashfree environment for script URL
const CASHFREE_ENV = process.env.NEXT_PUBLIC_CASHFREE_ENV || 'sandbox'
const CASHFREE_SCRIPT_URL =
  CASHFREE_ENV === 'production'
    ? 'https://sdk.cashfree.com/js/v3/cashfree.js'
    : 'https://sdk.cashfree.com/js/v3/cashfree.sandbox.js'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark scroll-smooth">
      <head>
        {/* Cashfree Payment Gateway SDK */}
        <Script
          src={CASHFREE_SCRIPT_URL}
          strategy="beforeInteractive"
        />
      </head>
      <body className={`${inter.className} min-h-screen flex flex-col`}>
        <Providers>
          <Navigation />
          <main className="pt-20 pb-10 flex-1">
            {children}
          </main>
          <Footer />
          <ApprovalCenter />
          <Toaster position="top-right" richColors />
        </Providers>
      </body>
    </html>
  )
}