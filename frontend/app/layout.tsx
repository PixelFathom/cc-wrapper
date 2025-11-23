import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers'
import { Navigation } from '@/components/navigation'
import { Footer } from '@/components/footer'
import { ApprovalCenter } from '@/components/approval-center'
import { Toaster } from 'sonner'
import { BetterStackWebVitals } from '@logtail/next'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Tediux - AI-Powered Development Platform',
  description: 'Build, deploy, and collaborate with AI-powered development tools',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark scroll-smooth">
      <head></head>
      <body className={`${inter.className} min-h-screen flex flex-col`}>
        <Providers>
          <Navigation />
          <main className="pt-20 pb-10 flex-1">
            {children}
          </main>
          <Footer />
          <ApprovalCenter />
          <Toaster position="top-right" richColors />
          <BetterStackWebVitals />
        </Providers>
      </body>
    </html>
  )
}