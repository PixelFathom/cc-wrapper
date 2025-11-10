'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useApiError } from '@/lib/hooks/useApiError'
import api from '@/lib/api'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export default function TestAPIRateLimitPage() {
  const [loading, setLoading] = useState(false)
  const [response, setResponse] = useState<any>(null)
  const [error, setError] = useState<any>(null)
  const { handleApiError } = useApiError()

  // Test the actual /api/query endpoint
  const testQueryEndpoint = async () => {
    setLoading(true)
    setError(null)
    setResponse(null)

    try {
      const result = await api.sendQuery({
        prompt: 'Test message for rate limiting',
        org_name: 'default',
        cwd: 'test',
        permission_mode: 'bypassPermissions',
        agent_name: null,
      })

      setResponse(result)
      toast.success('API call succeeded!')
    } catch (err: any) {
      console.error('API Error caught:', err)
      setError({
        message: err.message,
        status: err.status,
        responseData: err.responseData,
        stack: err.stack,
      })

      // Handle the error with our rate limit handler
      const wasRateLimitError = handleApiError(err)

      if (wasRateLimitError) {
        toast.info('Rate limit error detected and handled!')
      } else {
        toast.error('API Error', {
          description: err.message || 'An error occurred',
        })
      }
    } finally {
      setLoading(false)
    }
  }

  // Test getting projects (another authenticated endpoint)
  const testProjectsEndpoint = async () => {
    setLoading(true)
    setError(null)
    setResponse(null)

    try {
      const result = await api.getProjects()
      setResponse(result)
      toast.success('Projects fetched successfully!')
    } catch (err: any) {
      console.error('API Error caught:', err)
      setError({
        message: err.message,
        status: err.status,
        responseData: err.responseData,
        stack: err.stack,
      })

      const wasRateLimitError = handleApiError(err)

      if (wasRateLimitError) {
        toast.info('Rate limit error detected and handled!')
      } else {
        toast.error('API Error', {
          description: err.message || 'An error occurred',
        })
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto py-8">
      <Card className="max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle>Test Real API Rate Limiting</CardTitle>
          <CardDescription>
            Test actual API endpoints to verify rate limit handling.
            These buttons make real API calls and will trigger the rate limit banner if you exceed the limit.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3">
            <Button
              onClick={testQueryEndpoint}
              disabled={loading}
              variant="default"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Test /api/query Endpoint
            </Button>

            <Button
              onClick={testProjectsEndpoint}
              disabled={loading}
              variant="secondary"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Test /api/projects Endpoint
            </Button>
          </div>

          {/* Error Display */}
          {error && (
            <div className="mt-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-sm font-medium text-destructive mb-2">Error Details:</p>
              <div className="text-xs space-y-1 font-mono">
                <p>Message: {error.message}</p>
                <p>Status: {error.status || 'Unknown'}</p>
                {error.responseData && (
                  <div>
                    <p>Response Data:</p>
                    <pre className="mt-1 p-2 bg-background rounded">
                      {JSON.stringify(error.responseData, null, 2)}
                    </pre>
                  </div>
                )}
                {error.stack && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-muted-foreground">Stack Trace</summary>
                    <pre className="mt-1 p-2 bg-background rounded text-xs">
                      {error.stack}
                    </pre>
                  </details>
                )}
              </div>
            </div>
          )}

          {/* Success Response Display */}
          {response && (
            <div className="mt-4 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
              <p className="text-sm font-medium text-green-600 mb-2">Success Response:</p>
              <pre className="text-xs overflow-auto">
                {JSON.stringify(response, null, 2)}
              </pre>
            </div>
          )}

          <div className="mt-6 p-4 bg-secondary/50 rounded-lg">
            <p className="text-sm font-medium mb-2">Instructions:</p>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Click the buttons to make real API calls</li>
              <li>If you exceed the rate limit (2 requests per 24 hours), the banner should appear</li>
              <li>Check the browser console for detailed error logs</li>
              <li>Error details will be displayed below the buttons</li>
            </ul>
          </div>

          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm font-medium mb-2">Rate Limit Info:</p>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Current limit: 2 requests per 24 hour window</li>
              <li>The limit applies per user ID</li>
              <li>429 status code indicates rate limit exceeded</li>
              <li>The banner will show time remaining until you can retry</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}