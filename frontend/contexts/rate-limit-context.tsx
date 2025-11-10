'use client'

import React, { createContext, useContext, useState, useCallback } from 'react'
import { RateLimitBanner, RateLimitInfo } from '@/components/rate-limit-banner'

interface RateLimitContextType {
  showRateLimitError: (error: RateLimitInfo) => void
  clearRateLimitError: () => void
  rateLimitInfo: RateLimitInfo | null
}

const RateLimitContext = createContext<RateLimitContextType | undefined>(undefined)

export function RateLimitProvider({ children }: { children: React.ReactNode }) {
  const [rateLimitInfo, setRateLimitInfo] = useState<RateLimitInfo | null>(null)

  const showRateLimitError = useCallback((error: RateLimitInfo) => {
    setRateLimitInfo(error)
  }, [])

  const clearRateLimitError = useCallback(() => {
    setRateLimitInfo(null)
  }, [])

  return (
    <RateLimitContext.Provider value={{ showRateLimitError, clearRateLimitError, rateLimitInfo }}>
      <RateLimitBanner
        rateLimitInfo={rateLimitInfo}
        onDismiss={clearRateLimitError}
      />
      {children}
    </RateLimitContext.Provider>
  )
}

export function useRateLimit() {
  const context = useContext(RateLimitContext)
  if (context === undefined) {
    throw new Error('useRateLimit must be used within a RateLimitProvider')
  }
  return context
}