'use client'

import { ReactNode } from 'react'
import { useMobile } from '@/lib/hooks/useMobile'
import { cn } from '@/lib/utils'

interface MobileChatLayoutProps {
  children: ReactNode
  className?: string
}

/**
 * Mobile-optimized chat layout wrapper
 * Provides responsive design adjustments for mobile vs desktop
 */
export function MobileChatLayout({ children, className }: MobileChatLayoutProps) {
  const isMobile = useMobile()

  return (
    <div
      className={cn(
        'flex flex-col h-full w-full',
        // Mobile-specific styles
        isMobile && [
          'min-h-screen',
          'overflow-x-hidden',
          'text-sm',
        ],
        // Desktop styles
        !isMobile && [
          'min-h-[600px]',
          'text-base',
        ],
        className
      )}
    >
      {children}
    </div>
  )
}

/**
 * Mobile-optimized chat header component
 */
interface MobileChatHeaderProps {
  children: ReactNode
  className?: string
}

export function MobileChatHeader({ children, className }: MobileChatHeaderProps) {
  const isMobile = useMobile()

  return (
    <div
      className={cn(
        'flex items-center justify-between border-b border-border bg-card/80 backdrop-blur-sm',
        isMobile ? 'px-2 py-1.5' : 'px-4 py-2',
        className
      )}
    >
      {children}
    </div>
  )
}

/**
 * Mobile-optimized chat content area
 */
interface MobileChatContentProps {
  children: ReactNode
  className?: string
}

export function MobileChatContent({ children, className }: MobileChatContentProps) {
  const isMobile = useMobile()

  return (
    <div
      className={cn(
        'flex-1 overflow-y-auto bg-card/30 font-mono relative',
        isMobile ? 'p-2 space-y-2 text-xs' : 'p-4 space-y-4 text-sm',
        className
      )}
    >
      {children}
    </div>
  )
}

/**
 * Mobile-optimized chat input area
 */
interface MobileChatInputProps {
  children: ReactNode
  className?: string
}

export function MobileChatInput({ children, className }: MobileChatInputProps) {
  const isMobile = useMobile()

  return (
    <div
      className={cn(
        'border-t border-border bg-card/50',
        isMobile ? 'p-2' : 'p-3',
        className
      )}
    >
      {children}
    </div>
  )
}

/**
 * Mobile-optimized message container
 */
interface MobileMessageContainerProps {
  children: ReactNode
  className?: string
  isUser?: boolean
}

export function MobileMessageContainer({ 
  children, 
  className, 
  isUser = false 
}: MobileMessageContainerProps) {
  const isMobile = useMobile()

  return (
    <div
      className={cn(
        'rounded-lg border',
        isUser 
          ? 'bg-cyan-500/10 border-cyan-500/30' 
          : 'bg-purple-500/10 border-purple-500/30',
        isMobile ? 'p-2' : 'p-3',
        className
      )}
    >
      {children}
    </div>
  )
}

/**
 * Mobile-optimized button component
 */
interface MobileButtonProps {
  children: ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'ghost'
  disabled?: boolean
  className?: string
}

export function MobileButton({ 
  children, 
  onClick, 
  variant = 'primary',
  disabled = false,
  className 
}: MobileButtonProps) {
  const isMobile = useMobile()

  const baseStyles = cn(
    'font-mono transition-all rounded-md tap-target',
    isMobile ? 'px-2 py-1 text-xs' : 'px-3 py-2 text-sm',
    disabled && 'opacity-50 cursor-not-allowed'
  )

  const variantStyles = {
    primary: 'bg-cyan-500 hover:bg-cyan-600 text-black hover:glow-cyan',
    secondary: 'bg-secondary hover:bg-secondary/80 text-secondary-foreground',
    ghost: 'hover:bg-muted text-muted-foreground hover:text-foreground'
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(baseStyles, variantStyles[variant], className)}
    >
      {children}
    </button>
  )
}