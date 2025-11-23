'use client'

import { ApiError } from '@/lib/api'
import { RateLimitInfo } from '@/components/rate-limit-banner'

interface ApiWrapperOptions {
  onRateLimit?: (info: RateLimitInfo) => void
  onError?: (error: unknown) => void
  showToast?: boolean
}

/**
 * Wrapper function for API calls that handles rate limiting and other errors
 * @param apiCall - The async API call to execute
 * @param options - Options for error handling
 * @returns The result of the API call or throws the error
 */
export async function withApiErrorHandling<T>(
  apiCall: () => Promise<T>,
  options: ApiWrapperOptions = {}
): Promise<T> {
  try {
    return await apiCall()
  } catch (error) {
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

      if (options.onRateLimit) {
        options.onRateLimit(rateLimitInfo)
      }

      // Show a toast if requested
      if (options.showToast && typeof window !== 'undefined') {
        const { toast } = await import('sonner')
        toast.error('Rate Limit Exceeded', {
          description: detail,
          duration: 5000,
        })
      }
    } else if (options.onError) {
      options.onError(error)
    }

    // Re-throw the error so the caller can handle it
    throw error
  }
}

/**
 * React hook wrapper for use with useApiError hook
 * Example usage:
 *
 * const { handleApiError } = useApiError()
 *
 * const handleSubmit = async () => {
 *   try {
 *     await apiCallWithErrorHandling(
 *       () => api.someMethod(),
 *       handleApiError
 *     )
 *   } catch (error) {
 *     // Handle non-rate-limit errors
 *     console.error(error)
 *   }
 * }
 */
export async function apiCallWithErrorHandling<T>(
  apiCall: () => Promise<T>,
  handleApiError: (error: unknown) => boolean
): Promise<T> {
  try {
    return await apiCall()
  } catch (error) {
    const handled = handleApiError(error)

    if (!handled) {
      // If not a rate limit error, you might want to show a generic error toast
      if (typeof window !== 'undefined') {
        const { toast } = await import('sonner')

        if (error instanceof ApiError) {
          toast.error(`API Error (${error.status})`, {
            description: error.message,
          })
        } else if (error instanceof Error) {
          toast.error('Error', {
            description: error.message,
          })
        }
      }
    }

    throw error
  }
}