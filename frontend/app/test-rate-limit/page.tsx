'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useApiError } from '@/lib/hooks/useApiError'
import { ApiError } from '@/lib/api'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export default function TestRateLimitPage() {
  const [loading, setLoading] = useState(false)
  const { handleApiError } = useApiError()

  // Simulate a 429 error
  const triggerRateLimitError = () => {
    setLoading(true)

    // Simulate an API error with 429 status
    setTimeout(() => {
      const error = new ApiError(
        'Rate limit exceeded: 2 requests per 24 hour window.',
        429,
        {
          detail: 'Rate limit exceeded: 2 requests per 24 hour window.',
          retry_after: 86400 // 24 hours in seconds
        }
      )

      // Handle the error
      const wasHandled = handleApiError(error)

      if (wasHandled) {
        toast.success('Rate limit banner should now be visible at the top of the page!')
      }

      setLoading(false)
    }, 1000)
  }

  // Test with different retry_after values
  const triggerShortRateLimitError = () => {
    setLoading(true)

    setTimeout(() => {
      const error = new ApiError(
        'Rate limit exceeded: 2 requests per 1 hour window.',
        429,
        {
          detail: 'Rate limit exceeded: 2 requests per 1 hour window.',
          retry_after: 60 // 1 minute for testing
        }
      )

      handleApiError(error)
      toast.info('Rate limit banner with 1-minute countdown should be visible!')
      setLoading(false)
    }, 1000)
  }

  // Test without retry_after
  const triggerRateLimitNoRetry = () => {
    setLoading(true)

    setTimeout(() => {
      const error = new ApiError(
        'Rate limit exceeded: 2 requests per 24 hour window.',
        429,
        {
          detail: 'Rate limit exceeded: 2 requests per 24 hour window.'
        }
      )

      handleApiError(error)
      toast.info('Rate limit banner without countdown should be visible!')
      setLoading(false)
    }, 1000)
  }

  return (
    <div className="container mx-auto py-8">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Test Rate Limit Banner</CardTitle>
          <CardDescription>
            Use these buttons to test the rate limit banner functionality.
            Each button simulates a different rate limit scenario.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3">
            <Button
              onClick={triggerRateLimitError}
              disabled={loading}
              variant="default"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Trigger 24-Hour Rate Limit
            </Button>

            <Button
              onClick={triggerShortRateLimitError}
              disabled={loading}
              variant="secondary"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Trigger 1-Minute Rate Limit (for testing countdown)
            </Button>

            <Button
              onClick={triggerRateLimitNoRetry}
              disabled={loading}
              variant="outline"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Trigger Rate Limit (no retry_after)
            </Button>
          </div>

          <div className="mt-6 p-4 bg-secondary/50 rounded-lg">
            <p className="text-sm font-medium mb-2">What to expect:</p>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>A red banner should appear at the top of the page</li>
              <li>The banner displays the rate limit message</li>
              <li>If retry_after is provided, a countdown timer shows</li>
              <li>The banner can be dismissed with the X button</li>
              <li>The banner persists across page navigation</li>
            </ul>
          </div>

          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm font-medium mb-2">Troubleshooting:</p>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>If no banner appears, check the browser console for errors</li>
              <li>Ensure RateLimitProvider is in the app layout</li>
              <li>Verify that useApiError hook is properly imported</li>
              <li>Check that the toast notification appears</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}