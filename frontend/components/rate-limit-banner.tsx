'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, X } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

export interface RateLimitInfo {
  message: string
  retryAfter?: number // seconds until retry is allowed
  limit?: number
  windowHours?: number
}

interface RateLimitBannerProps {
  rateLimitInfo: RateLimitInfo | null
  onDismiss?: () => void
}

export function RateLimitBanner({ rateLimitInfo, onDismiss }: RateLimitBannerProps) {
  const [secondsRemaining, setSecondsRemaining] = useState<number>(0)

  useEffect(() => {
    if (rateLimitInfo?.retryAfter) {
      setSecondsRemaining(rateLimitInfo.retryAfter)

      const interval = setInterval(() => {
        setSecondsRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(interval)
            return 0
          }
          return prev - 1
        })
      }, 1000)

      return () => clearInterval(interval)
    }
  }, [rateLimitInfo])

  if (!rateLimitInfo) return null

  const formatTimeRemaining = (seconds: number): string => {
    if (seconds <= 0) return 'now'

    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    const parts = []
    if (hours > 0) parts.push(`${hours}h`)
    if (minutes > 0) parts.push(`${minutes}m`)
    if (secs > 0 && hours === 0) parts.push(`${secs}s`)

    return parts.join(' ')
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 p-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
      <Alert className="max-w-4xl mx-auto bg-destructive/10 border-destructive/20">
        <AlertCircle className="h-4 w-4 text-destructive" />
        <AlertTitle className="text-destructive font-semibold">
          Rate Limit Exceeded
        </AlertTitle>
        <AlertDescription className="mt-2 flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">
              {rateLimitInfo.message}
            </p>
            {secondsRemaining > 0 && (
              <p className="text-sm font-medium">
                You can try again in: <span className="text-primary">{formatTimeRemaining(secondsRemaining)}</span>
              </p>
            )}
            {rateLimitInfo.limit && rateLimitInfo.windowHours && (
              <p className="text-xs text-muted-foreground mt-2">
                Current limit: {rateLimitInfo.limit} requests per {rateLimitInfo.windowHours} hour{rateLimitInfo.windowHours > 1 ? 's' : ''}
              </p>
            )}
          </div>
          {onDismiss && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 -mt-1 -mr-2"
              onClick={onDismiss}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Dismiss</span>
            </Button>
          )}
        </AlertDescription>
      </Alert>
    </div>
  )
}