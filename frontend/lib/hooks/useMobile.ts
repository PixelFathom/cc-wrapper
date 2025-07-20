'use client'

import { useState, useEffect } from 'react'

/**
 * Custom hook to detect mobile screen size
 * @param breakpoint - The breakpoint in pixels (default: 768)
 * @returns boolean indicating if screen is mobile size
 */
export function useMobile(breakpoint: number = 768): boolean {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < breakpoint)
    }

    // Check on mount
    checkMobile()

    // Add event listener for resize
    window.addEventListener('resize', checkMobile)

    // Cleanup
    return () => window.removeEventListener('resize', checkMobile)
  }, [breakpoint])

  return isMobile
}

/**
 * Custom hook to get responsive text based on screen size
 * @param mobileText - Text to show on mobile
 * @param desktopText - Text to show on desktop
 * @param breakpoint - The breakpoint in pixels (default: 768)
 * @returns appropriate text for current screen size
 */
export function useResponsiveText(
  mobileText: string, 
  desktopText: string, 
  breakpoint: number = 768
): string {
  const isMobile = useMobile(breakpoint)
  return isMobile ? mobileText : desktopText
}

/**
 * Custom hook to get responsive values based on screen size
 * @param mobileValue - Value to return on mobile
 * @param desktopValue - Value to return on desktop
 * @param breakpoint - The breakpoint in pixels (default: 768)
 * @returns appropriate value for current screen size
 */
export function useResponsiveValue<T>(
  mobileValue: T, 
  desktopValue: T, 
  breakpoint: number = 768
): T {
  const isMobile = useMobile(breakpoint)
  return isMobile ? mobileValue : desktopValue
}