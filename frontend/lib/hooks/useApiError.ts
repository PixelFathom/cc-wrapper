'use client'

import { useCallback } from 'react'
import { useRateLimit } from '@/contexts/rate-limit-context'
import { ApiError } from '@/lib/api'
import { RateLimitInfo } from '@/components/rate-limit-banner'

export function useApiError() {
  const { showRateLimitError } = useRateLimit()

  const handleApiError = useCallback((error: unknown) => {
    if (error instanceof ApiError && error.status === 429) {
      // Parse the error message to extract rate limit details
      const detail = error.responseData?.detail || error.message

      // Extract numbers from message like "Rate limit exceeded: 2 requests per 24 hour window."
      const limitMatch = detail.match(/(\d+)\s+requests?\s+per\s+(\d+)\s+hour/i)
      const limit = limitMatch ? parseInt(limitMatch[1]) : undefined
      const windowHours = limitMatch ? parseInt(limitMatch[2]) : undefined

      const rateLimitInfo: RateLimitInfo = {
        message: detail,
        retryAfter: error.responseData?.retry_after,
        limit,
        windowHours,
      }

      showRateLimitError(rateLimitInfo)
      return true // Indicates that the error was handled
    }

    return false // Error was not handled as rate limit
  }, [showRateLimitError])

  return { handleApiError }
}