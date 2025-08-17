'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'

interface BasicAuthContextType {
  isAuthenticated: boolean
  login: (username: string, password: string) => Promise<boolean>
  logout: () => void
  isLoading: boolean
}

const BasicAuthContext = createContext<BasicAuthContextType | undefined>(undefined)

export function BasicAuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Check for existing session on mount
  useEffect(() => {
    const checkAuth = () => {
      try {
        const authData = localStorage.getItem('basic-auth-session')
        if (authData) {
          const { timestamp, authenticated } = JSON.parse(authData)
          // Session expires after 24 hours
          const sessionDuration = 24 * 60 * 60 * 1000
          const isExpired = Date.now() - timestamp > sessionDuration
          
          if (!isExpired && authenticated) {
            setIsAuthenticated(true)
          } else {
            localStorage.removeItem('basic-auth-session')
          }
        }
      } catch (error) {
        console.error('Error checking auth session:', error)
        localStorage.removeItem('basic-auth-session')
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()
  }, [])

  const login = async (username: string, password: string): Promise<boolean> => {
    // Get credentials from environment variables
    // In Next.js, environment variables starting with NEXT_PUBLIC_ are available in the browser
    const envUsername = process.env.NEXT_PUBLIC_BASIC_AUTH_USERNAME
    const envPassword = process.env.NEXT_PUBLIC_BASIC_AUTH_PASSWORD
    
    const validUsername = envUsername || 'tedious'
    const validPassword = envPassword || 'TediousPassword123'

    // Use trimmed comparison to handle any whitespace issues
    const usernameMatch = username.trim() === validUsername.trim()
    const passwordMatch = password.trim() === validPassword.trim()
    
    if (usernameMatch && passwordMatch) {
      const authData = {
        authenticated: true,
        timestamp: Date.now()
      }
      localStorage.setItem('basic-auth-session', JSON.stringify(authData))
      setIsAuthenticated(true)
      return true
    }
    return false
  }

  const logout = () => {
    localStorage.removeItem('basic-auth-session')
    setIsAuthenticated(false)
  }

  return (
    <BasicAuthContext.Provider value={{
      isAuthenticated,
      login,
      logout,
      isLoading
    }}>
      {children}
    </BasicAuthContext.Provider>
  )
}

export function useBasicAuth() {
  const context = useContext(BasicAuthContext)
  if (context === undefined) {
    throw new Error('useBasicAuth must be used within a BasicAuthProvider')
  }
  return context
}