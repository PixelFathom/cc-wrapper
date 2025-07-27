import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers'
import { Navigation } from '@/components/navigation'
import { ApprovalCenter } from '@/components/approval-center'
import { AuthLoading } from '@/components/auth-loading'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Project Hub - Elegant Project Management',
  description: 'A sophisticated project management platform with real-time collaboration',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark scroll-smooth">
      <body className={`${inter.className} min-h-screen`}>
        <Providers>
          <AuthLoading>
            <Navigation />
            <main className="pt-20 pb-10">
              {children}
            </main>
            <ApprovalCenter />
          </AuthLoading>
        </Providers>
      </body>
    </html>
  )
}