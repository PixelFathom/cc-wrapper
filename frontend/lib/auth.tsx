'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { api } from './api'

interface User {
  id: string
  username: string
  email: string
  is_active: boolean
  is_superuser: boolean
}

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refreshToken: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Token storage helpers
const TOKEN_KEY = 'access_token'
const REFRESH_TOKEN_KEY = 'refresh_token'

export const getAccessToken = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(TOKEN_KEY)
  }
  return null
}

export const getRefreshToken = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(REFRESH_TOKEN_KEY)
  }
  return null
}

const setTokens = (accessToken: string, refreshToken: string) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(TOKEN_KEY, accessToken)
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
    
    // Also set in cookies for middleware
    document.cookie = `access_token=${accessToken}; path=/; max-age=${60 * 60 * 24}; samesite=strict`
    document.cookie = `refresh_token=${refreshToken}; path=/; max-age=${60 * 60 * 24 * 7}; samesite=strict`
  }
}

const clearTokens = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
    
    // Clear cookies
    document.cookie = 'access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC'
    document.cookie = 'refresh_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC'
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  // Check if user is authenticated on mount
  useEffect(() => {
    checkAuth()
    
    // Listen for unauthorized events
    const handleUnauthorized = () => {
      refreshToken()
    }
    
    window.addEventListener('auth:unauthorized', handleUnauthorized)
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized)
  }, [])

  const checkAuth = async () => {
    try {
      const token = getAccessToken()
      if (!token) {
        setLoading(false)
        return
      }

      const response = await fetch(`${api.baseUrl}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const userData = await response.json()
        setUser(userData)
      } else if (response.status === 401) {
        // Token expired, try to refresh
        await refreshToken()
      }
    } catch (error) {
      console.error('Auth check failed:', error)
    } finally {
      setLoading(false)
    }
  }

  const login = async (username: string, password: string) => {
    const response = await fetch(`${api.baseUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Login failed')
    }

    const data = await response.json()
    setTokens(data.access_token, data.refresh_token)
    
    // Get user data
    await checkAuth()
    
    // Redirect to home
    router.push('/')
  }

  const logout = async () => {
    try {
      const token = getAccessToken()
      if (token) {
        await fetch(`${api.baseUrl}/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
      }
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      clearTokens()
      setUser(null)
      router.push('/login')
    }
  }

  const refreshToken = async () => {
    try {
      const refreshTokenValue = getRefreshToken()
      if (!refreshTokenValue) {
        throw new Error('No refresh token')
      }

      const response = await fetch(`${api.baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh_token: refreshTokenValue })
      })

      if (!response.ok) {
        throw new Error('Token refresh failed')
      }

      const data = await response.json()
      setTokens(data.access_token, data.refresh_token)
      
      // Get updated user data
      await checkAuth()
    } catch (error) {
      console.error('Token refresh failed:', error)
      clearTokens()
      setUser(null)
      router.push('/login')
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshToken }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}