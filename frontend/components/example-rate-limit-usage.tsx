'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useApiError } from '@/lib/hooks/useApiError'
import { apiCallWithErrorHandling } from '@/lib/api-wrapper'
import api from '@/lib/api'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

/**
 * Example component demonstrating how to use the rate limit error handling
 * This can be integrated into any component that makes API calls
 */
export function ExampleRateLimitUsage() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<any>(null)
  const { handleApiError } = useApiError()

  // Example 1: Using the hook with manual error handling
  const handleApiCallWithHook = async () => {
    setLoading(true)
    try {
      const result = await apiCallWithErrorHandling(
        () => api.getProjects(), // Replace with any API call
        handleApiError
      )
      setData(result)
      toast.success('Projects loaded successfully')
    } catch (error) {
      // Error is already handled by the hook for rate limits
      // You can handle other errors here if needed
      console.error('API call failed:', error)
    } finally {
      setLoading(false)
    }
  }

  // Example 2: Direct API call with try-catch (rate limit banner will still show)
  const handleDirectApiCall = async () => {
    setLoading(true)
    try {
      const result = await api.getProjects()
      setData(result)
      toast.success('Projects loaded successfully')
    } catch (error) {
      // The ApiError will automatically trigger the rate limit banner if it's a 429
      handleApiError(error)

      // You can also check the error type for custom handling
      if (error instanceof Error) {
        console.error('API call failed:', error.message)
      }
    } finally {
      setLoading(false)
    }
  }

  // Example 3: Multiple API calls with rate limit handling
  const handleMultipleApiCalls = async () => {
    setLoading(true)
    try {
      // These calls will all respect rate limits
      const [projects] = await Promise.all([
        apiCallWithErrorHandling(() => api.getProjects(), handleApiError),
        // Add more API calls as needed
      ])

      setData({ projects })
      toast.success('All data loaded successfully')
    } catch (error) {
      // Rate limit errors are already handled
      console.error('One or more API calls failed:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Rate Limit Error Handling Example</CardTitle>
        <CardDescription>
          This demonstrates how to integrate rate limit error handling in your components.
          When a 429 error occurs, a banner will appear at the top of the page.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3">
          <Button
            onClick={handleApiCallWithHook}
            disabled={loading}
            variant="default"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            API Call with Hook
          </Button>

          <Button
            onClick={handleDirectApiCall}
            disabled={loading}
            variant="secondary"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Direct API Call
          </Button>

          <Button
            onClick={handleMultipleApiCalls}
            disabled={loading}
            variant="outline"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Multiple API Calls
          </Button>
        </div>

        {data && (
          <div className="mt-4 p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">API Response:</p>
            <pre className="text-xs mt-2 overflow-auto">
              {JSON.stringify(data, null, 2)}
            </pre>
          </div>
        )}

        <div className="mt-6 p-4 bg-secondary/50 rounded-lg">
          <p className="text-sm font-medium mb-2">Integration Guide:</p>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li>Import <code className="text-xs bg-muted px-1 py-0.5 rounded">useApiError</code> hook in your component</li>
            <li>Wrap API calls with <code className="text-xs bg-muted px-1 py-0.5 rounded">apiCallWithErrorHandling</code></li>
            <li>The rate limit banner will automatically appear when a 429 error occurs</li>
            <li>The banner shows remaining time and can be dismissed by the user</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}