'use client'

import { useAuth } from '@/lib/auth'
import { motion } from 'framer-motion'
import { CodeIcon } from '@radix-ui/react-icons'

export function AuthLoading({ children }: { children: React.ReactNode }) {
  const { loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="text-center"
        >
          <div className="relative group mb-8">
            <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-lg blur opacity-25 group-hover:opacity-75 transition duration-300 animate-pulse"></div>
            <div className="relative flex items-center space-x-2 bg-card px-4 py-3 rounded-lg border border-border">
              <CodeIcon className="h-6 w-6 text-cyan-500 animate-pulse" />
              <span className="font-mono text-lg">
                <span className="text-muted-foreground">$</span>
                <span className="text-cyan-500 ml-1">authenticating</span>
                <span className="animate-terminal-cursor ml-0.5">_</span>
              </span>
            </div>
          </div>
          <p className="text-muted-foreground">Verifying your credentials...</p>
        </motion.div>
      </div>
    )
  }

  return <>{children}</>
}