'use client'

import { useState, useEffect } from 'react'
import { Hero } from '@/components/hero'
import { DashboardTabs } from '@/components/dashboard-tabs'
import { FeaturesSection } from '@/components/features-section'
import { BenefitsSection } from '@/components/benefits-section'

export default function HomePage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    // Check authentication status
    const checkAuth = () => {
      const storedUser = localStorage.getItem('github_user')
      const isAuth = !!storedUser
      setIsAuthenticated(isAuth)
    }

    checkAuth()

    // Listen for storage changes
    window.addEventListener('storage', checkAuth)

    return () => {
      window.removeEventListener('storage', checkAuth)
    }
  }, [])

  return (
    <>
      <Hero />
      {!isAuthenticated && (
        <>
          <FeaturesSection />
          <BenefitsSection />
        </>
      )}
      <DashboardTabs />
    </>
  )
}