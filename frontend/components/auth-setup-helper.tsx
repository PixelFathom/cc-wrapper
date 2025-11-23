'use client'

import { useState, useEffect } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './ui/card'
import { Alert, AlertDescription } from './ui/alert'
import { CheckCircledIcon, ExclamationTriangleIcon } from '@radix-ui/react-icons'

export function AuthSetupHelper() {
  const [userId, setUserId] = useState('')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [showSetup, setShowSetup] = useState(false)

  useEffect(() => {
    // Check if user is authenticated
    const storedUser = localStorage.getItem('github_user')
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser)
        if (user.id) {
          setIsAuthenticated(true)
          setUserId(user.id)
        }
      } catch (e) {
        // Invalid user data
      }
    }
  }, [])

  const handleSetAuth = () => {
    if (!userId.trim()) return

    localStorage.setItem('github_user', JSON.stringify({ id: userId.trim() }))
    setIsAuthenticated(true)
    setShowSetup(false)
    // Refresh the page to reload data with auth
    window.location.reload()
  }

  const handleClearAuth = () => {
    localStorage.removeItem('github_user')
    setIsAuthenticated(false)
    setUserId('')
  }

  if (!showSetup && !isAuthenticated) {
    return (
      <Alert className="border-yellow-500/50 bg-yellow-500/10">
        <ExclamationTriangleIcon className="h-4 w-4 text-yellow-500" />
        <AlertDescription className="flex items-center justify-between">
          <span className="text-sm">Authentication required to view deployment hooks</span>
          <Button size="sm" variant="outline" onClick={() => setShowSetup(true)}>
            Set Up Auth
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  if (showSetup) {
    return (
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle>Authentication Setup</CardTitle>
          <CardDescription>
            Enter your user ID to authenticate API requests
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">User ID</label>
            <Input
              placeholder="59ca99bb-84ce-4bdd-aaef-a07003036eee"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              This will be stored in localStorage and used for API authentication
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex gap-2">
          <Button onClick={handleSetAuth} disabled={!userId.trim()}>
            Save & Reload
          </Button>
          <Button variant="outline" onClick={() => setShowSetup(false)}>
            Cancel
          </Button>
        </CardFooter>
      </Card>
    )
  }

  return null
}
