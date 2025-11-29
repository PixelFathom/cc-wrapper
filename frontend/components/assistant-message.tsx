'use client'

import { useState } from 'react'
import { ChatHook } from '@/lib/api'
import { UpdateIcon, DotFilledIcon, CopyIcon, CheckCircledIcon, CrossCircledIcon, ReloadIcon, ChevronDownIcon } from '@radix-ui/react-icons'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { useMobile } from '@/lib/hooks/useMobile'
import { MarkdownRenderer } from './markdown-renderer'
import { InlineHooksList } from './inline-hooks-list'

interface Message {
  id: string
  role: 'user' | 'assistant' | 'hook' | 'auto'
  content: any
  timestamp: string
  sessionId?: string
  isProcessing?: boolean
  chatId?: string
}

interface AssistantMessageProps {
  message: Message
  hooks?: ChatHook[]
  onToggleHook?: (hookId: string) => void
  expandedHooks?: Set<string>
  getHookIcon?: (hook: ChatHook) => JSX.Element
  formatHookMessage?: (hook: ChatHook) => string
  isWaitingForResponse?: boolean
  onRetry?: (chatId: string) => void
  isRetrying?: boolean
}

export function AssistantMessage({
  message,
  hooks = [],
  onToggleHook,
  expandedHooks = new Set(),
  getHookIcon,
  formatHookMessage,
  isWaitingForResponse = false,
  onRetry,
  isRetrying = false
}: AssistantMessageProps) {
  // Extract content from message
  const content = message.content?.text || ''
  const metadata = message.content?.metadata || {}

  // More robust processing detection - check if we have actual content
  const hasActualContent = content && content !== '' && content !== 'Processing your request...'
  const isProcessing = (message.isProcessing || metadata.status === 'processing') && !hasActualContent

  // Check if the message failed
  const isFailed = metadata.status === 'failed'
  const failureReason = metadata.error || metadata.failure_reason || 'Task execution failed'

  // Always show the full final content when available
  const hasContent = content && content !== ''
  const hasHooks = hooks.length > 0

  // Check if this is a final complete message (not processing)
  const isCompleteMessage = hasActualContent && !isProcessing && !isFailed

  const [isCopied, setIsCopied] = useState(false)
  const [showHooks, setShowHooks] = useState(isProcessing)
  const isMobile = useMobile(768)

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(content)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  return (
    <div className="space-y-3">
      {/* Main content */}
      <div className="space-y-2">
        {isFailed ? (
          <div className="space-y-3">
            {/* Failed banner */}
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <div className="flex items-start gap-2">
                <CrossCircledIcon className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-medium text-sm text-red-400">Task Failed</span>
                    {message.chatId && onRetry && (
                      <button
                        onClick={() => onRetry(message.chatId!)}
                        disabled={isRetrying}
                        className={cn(
                          "px-2.5 py-1 text-xs font-medium rounded-md transition-all",
                          "bg-red-500/20 hover:bg-red-500/30 text-red-300 hover:text-red-200",
                          "border border-red-500/30 hover:border-red-500/40",
                          "disabled:opacity-50 disabled:cursor-not-allowed"
                        )}
                      >
                        {isRetrying ? (
                          <span className="flex items-center gap-1.5">
                            <UpdateIcon className="h-3 w-3 animate-spin" />
                            Retrying...
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5">
                            <ReloadIcon className="h-3 w-3" />
                            Retry
                          </span>
                        )}
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {failureReason}
                  </p>
                </div>
              </div>
            </div>
            {/* Show any partial content if available */}
            {hasContent && (
              <MarkdownRenderer
                content={content}
                className="text-foreground leading-relaxed break-words opacity-70"
              />
            )}
          </div>
        ) : isCompleteMessage ? (
          <MarkdownRenderer
            content={content}
            className="text-foreground leading-relaxed break-words"
          />
        ) : isProcessing ? (
          <div className="flex items-center space-x-2 flex-wrap">
            <UpdateIcon className="h-4 w-4 text-purple-500 animate-spin flex-shrink-0" />
            <span className="text-purple-500 font-mono text-xs sm:text-sm break-words">
              {isMobile ? 'Processing...' : 'Processing your request...'}
            </span>
          </div>
        ) : (
          <div className="flex items-center space-x-2 text-muted-foreground flex-wrap">
            <DotFilledIcon className="h-4 w-4 animate-pulse flex-shrink-0" />
            <span className="font-mono text-xs sm:text-sm break-words">
              {isMobile ? 'Waiting...' : 'Waiting for response...'}
            </span>
          </div>
        )}
      </div>

      {/* Copy button - only show for complete messages */}
      {isCompleteMessage && (
        <div className="mt-2">
          <button
            onClick={copyToClipboard}
            className={cn(
              "inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs",
              "transition-all duration-200",
              "border border-transparent",
              isCopied
                ? "bg-green-500/20 text-green-500 border-green-500/30"
                : "hover:bg-muted/50 text-muted-foreground hover:text-foreground hover:border-border/50"
            )}
          >
            {isCopied ? (
              <>
                <CheckCircledIcon className="h-3 w-3" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <CopyIcon className="h-3 w-3" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Processing Steps / Hooks - Using InlineHooksList (same UI as subtask hooks) */}
      {hasHooks && (
        <div className="space-y-2">
          <button
            onClick={() => setShowHooks(!showHooks)}
            className={cn(
              "flex items-center space-x-2 text-xs font-mono transition-colors px-2 py-1 rounded-md w-full sm:w-auto justify-center sm:justify-start",
              isProcessing
                ? "bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 border border-purple-500/30"
                : "bg-muted/20 text-muted-foreground hover:text-foreground"
            )}
          >
            <ChevronDownIcon className={cn(
              "h-3 w-3 transition-transform flex-shrink-0",
              showHooks && "rotate-180"
            )} />
            <span className="truncate">
              {isProcessing
                ? (isMobile ? 'Processing...' : 'Processing Steps...')
                : (isMobile ? 'Steps' : 'Processing Steps')
              }
            </span>
            <span className={cn(
              "font-semibold flex-shrink-0",
              isProcessing ? "text-purple-400" : "text-purple-400"
            )}>({hooks.length})</span>
          </button>

          <AnimatePresence>
            {showHooks && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <InlineHooksList hooks={hooks} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
