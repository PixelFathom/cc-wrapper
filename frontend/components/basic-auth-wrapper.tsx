'use client'

import React from 'react'
import { useBasicAuth } from '@/contexts/basic-auth-context'
import { BasicAuthLogin } from '@/components/basic-auth-login'

interface BasicAuthWrapperProps {
  children: React.ReactNode
}

export function BasicAuthWrapper({ children }: BasicAuthWrapperProps) {
  const { isAuthenticated, isLoading } = useBasicAuth()


  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-white">Loading...</p>
        </div>
      </div>
    )
  }

  // Show login form if not authenticated
  if (!isAuthenticated) {
    return <BasicAuthLogin />
  }

  // Render the protected content if authenticated
  return <>{children}</>
}