'use client'

import { motion } from 'framer-motion'
import { UpdateIcon, ClockIcon, ListBulletIcon } from '@radix-ui/react-icons'
import { cn } from '@/lib/utils'
import { useMobile } from '@/lib/hooks/useMobile'

interface MobileWaitingResponseProps {
  isWaiting: boolean
  isQueueProcessing: boolean
  queueLength: number
  className?: string
}

/**
 * Clean, mobile-optimized waiting response indicator
 * Consolidates all waiting states into a single, unobtrusive component
 */
export function MobileWaitingResponse({
  isWaiting,
  isQueueProcessing,
  queueLength,
  className
}: MobileWaitingResponseProps) {
  const isMobile = useMobile()

  // Don't show anything if not waiting
  if (!isWaiting && !isQueueProcessing && queueLength === 0) {
    return null
  }

  const getStatusInfo = () => {
    if (isQueueProcessing) {
      return {
        icon: <UpdateIcon className="h-3 w-3 animate-spin" />,
        text: 'Processing...',
        bgColor: 'bg-amber-500/10',
        borderColor: 'border-amber-500/30',
        textColor: 'text-amber-500'
      }
    }

    if (isWaiting) {
      return {
        icon: <UpdateIcon className="h-3 w-3 animate-spin" />,
        text: 'Waiting...',
        bgColor: 'bg-cyan-500/10',
        borderColor: 'border-cyan-500/30',
        textColor: 'text-cyan-500'
      }
    }

    if (queueLength > 0) {
      return {
        icon: <ListBulletIcon className="h-3 w-3" />,
        text: `${queueLength} queued`,
        bgColor: 'bg-purple-500/10',
        borderColor: 'border-purple-500/30',
        textColor: 'text-purple-500'
      }
    }

    return null
  }

  const statusInfo = getStatusInfo()
  if (!statusInfo) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.95 }}
      transition={{
        type: "spring",
        stiffness: 400,
        damping: 25
      }}
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-full backdrop-blur-md",
        "border shadow-sm transition-all duration-300",
        statusInfo.bgColor,
        statusInfo.borderColor,
        statusInfo.textColor,
        isMobile ? "text-xs" : "text-sm",
        className
      )}
    >
      <div className="flex items-center gap-2">
        {statusInfo.icon}
        <span className="font-medium whitespace-nowrap">
          {statusInfo.text}
        </span>
      </div>

      {/* Progress dots animation */}
      {(isWaiting || isQueueProcessing) && (
        <div className="flex items-center gap-0.5 ml-1">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className={cn(
                "w-1 h-1 rounded-full",
                statusInfo.textColor.replace('text-', 'bg-')
              )}
              animate={{
                opacity: [0.3, 1, 0.3],
                scale: [0.8, 1, 0.8],
              }}
              transition={{
                duration: 1.2,
                repeat: Infinity,
                delay: i * 0.2,
                ease: "easeInOut"
              }}
            />
          ))}
        </div>
      )}
    </motion.div>
  )
}

/**
 * Minimal input area status indicator
 * Shows only essential status without cluttering the UI
 */
interface MobileInputStatusProps {
  isWaiting: boolean
  isQueueProcessing: boolean
  queueLength: number
  inputLength: number
  showHints?: boolean
}

export function MobileInputStatus({
  isWaiting,
  isQueueProcessing,
  queueLength,
  inputLength,
  showHints = true
}: MobileInputStatusProps) {
  const isMobile = useMobile()

  // Clean, minimal status - only show essential information
  const getStatusText = () => {
    if (isQueueProcessing) {
      return {
        text: isMobile ? 'Processing...' : 'Processing...',
        color: 'text-amber-500'
      }
    }

    if (isWaiting) {
      return {
        text: isMobile ? 'Waiting...' : 'Waiting...',
        color: 'text-cyan-500'
      }
    }

    if (queueLength > 0) {
      return {
        text: `${queueLength} queued`,
        color: 'text-purple-500'
      }
    }

    // Only show hints on desktop when not processing anything
    if (showHints && !isMobile && inputLength === 0) {
      return {
        text: 'Press Enter to send',
        color: 'text-muted-foreground/50'
      }
    }

    return null
  }

  const status = getStatusText()

  return (
    <div className="flex items-center justify-between text-xs">
      <div className="flex items-center gap-2">
        {status && (
          <motion.div
            key={status.text}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
            className={cn("flex items-center gap-1", status.color)}
          >
            {(isWaiting || isQueueProcessing) && (
              <UpdateIcon className="h-3 w-3 animate-spin" />
            )}
            {queueLength > 0 && !isWaiting && !isQueueProcessing && (
              <ListBulletIcon className="h-3 w-3" />
            )}
            <span>{status.text}</span>
          </motion.div>
        )}
      </div>

      {/* Character count - only show when typing */}
      {inputLength > 0 && (
        <motion.span
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          className={cn(
            "transition-colors",
            inputLength > 500 ? "text-orange-500" : "text-muted-foreground/70"
          )}
        >
          {inputLength}
        </motion.span>
      )}
    </div>
  )
}

/**
 * Mobile-optimized floating waiting indicator
 * Appears over the chat area when processing
 */
interface FloatingWaitingIndicatorProps {
  isVisible: boolean
  isQueueProcessing: boolean
  queueLength: number
  onDismiss?: () => void
}

export function FloatingWaitingIndicator({
  isVisible,
  isQueueProcessing,
  queueLength,
  onDismiss
}: FloatingWaitingIndicatorProps) {
  const isMobile = useMobile()

  if (!isVisible) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 50, scale: 0.9 }}
      transition={{
        type: "spring",
        stiffness: 300,
        damping: 20
      }}
      className="fixed bottom-20 left-1/2 transform -translate-x-1/2 z-40"
    >
      <div className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-2xl backdrop-blur-xl shadow-2xl border",
        "bg-black/60 border-white/10",
        isMobile ? "text-sm" : "text-base"
      )}>
        <div className="relative">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="w-6 h-6 rounded-full border-2 border-cyan-500/30 border-t-cyan-500"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse" />
          </div>
        </div>

        <div className="flex flex-col">
          <span className="text-white font-medium">
            {isQueueProcessing ? 'Processing...' : 'Thinking...'}
          </span>
          {queueLength > 0 && (
            <span className="text-white/70 text-xs">
              {queueLength} in queue
            </span>
          )}
        </div>

        {onDismiss && (
          <button
            onClick={onDismiss}
            className="ml-2 text-white/50 hover:text-white/80 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </motion.div>
  )
}