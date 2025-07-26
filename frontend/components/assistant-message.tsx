'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api, ChatHook } from '@/lib/api'
import { MessageHooks } from './message-hooks'
import { UpdateIcon, CircleIcon, ChevronDownIcon, DotFilledIcon, CopyIcon, CheckCircledIcon } from '@radix-ui/react-icons'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { useMobile } from '@/lib/hooks/useMobile'
import { MarkdownRenderer } from './markdown-renderer'

interface Message {
  id: string
  role: 'user' | 'assistant' | 'hook'
  content: any
  timestamp: string
  sessionId?: string
  isProcessing?: boolean
}

interface AssistantMessageProps {
  message: Message
  hooks?: ChatHook[]
  onToggleHook?: (hookId: string) => void
  expandedHooks?: Set<string>
  getHookIcon?: (hook: ChatHook) => JSX.Element
  formatHookMessage?: (hook: ChatHook) => string
  isWaitingForResponse?: boolean
}

export function AssistantMessage({ 
  message, 
  hooks = [], 
  onToggleHook, 
  expandedHooks = new Set(), 
  getHookIcon, 
  formatHookMessage,
  isWaitingForResponse = false 
}: AssistantMessageProps) {
  // Extract content from message
  const content = message.content?.text || ''
  const metadata = message.content?.metadata || {}
  const isProcessing = message.isProcessing || metadata.status === 'processing'
  
  // Always show the full final content when available
  const hasContent = content && content !== ''
  const hasHooks = hooks.length > 0
  
  // Check if this is a final complete message (not processing)
  const isCompleteMessage = hasContent && !isProcessing
  
  // Show hooks by default when processing, hide when complete
  const [showHooks, setShowHooks] = useState(isProcessing && hasHooks)
  const [isCopied, setIsCopied] = useState(false)
  const isMobile = useMobile(768)
  
  // Update showHooks when processing state changes
  useEffect(() => {
    if (isProcessing && hasHooks) {
      setShowHooks(true)
    }
  }, [isProcessing, hasHooks])
  
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
        {isCompleteMessage ? (
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
      
      {/* Processing Steps / Hooks - Always show expand button for any message with hooks */}
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
                className={cn(
                  "space-y-2 ml-2 sm:ml-4 border-l-2 pl-2 sm:pl-4 overflow-hidden",
                  isProcessing ? "border-purple-500/50" : "border-purple-500/30"
                )}
              >
                {hooks.map((hook, index) => {
                  const isExpanded = expandedHooks?.has(hook.id) || false
                  
                  return (
                    <motion.div
                      key={hook.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ 
                        delay: isProcessing ? index * 0.05 : 0,
                        duration: 0.2
                      }}
                      className="text-xs"
                    >
                      <button
                        onClick={() => onToggleHook?.(hook.id)}
                        className="w-full text-left hover:bg-muted/30 rounded p-2 transition-colors overflow-hidden"
                      >
                        <div className="flex items-start gap-2">
                          {getHookIcon?.(hook) || <DotFilledIcon className="h-3 w-3 text-gray-500 flex-shrink-0" />}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-muted-foreground truncate flex-1 min-w-0">
                                {formatHookMessage?.(hook) || hook.message || 'Processing'}
                              </span>
                              {hook.data?.duration_ms && (
                                <span className="text-[10px] text-muted-foreground/70 flex-shrink-0">
                                  {hook.data.duration_ms}ms
                                </span>
                              )}
                            </div>
                            
                            {/* Tool input preview */}
                            {hook.tool_name && hook.data?.tool_input && (
                              <div className="text-[10px] text-muted-foreground/70 mt-1 font-mono truncate">
                                {JSON.stringify(hook.data.tool_input).substring(0, isMobile ? 30 : 80)}...
                              </div>
                            )}
                          </div>
                          <ChevronDownIcon className={cn(
                            "h-3 w-3 transition-transform text-muted-foreground/50 flex-shrink-0",
                            isExpanded && "rotate-180"
                          )} />
                        </div>
                      </button>
                      
                      {/* Expanded details */}
                      {isExpanded && hook.data && (
                        <div className="mt-2 ml-3 sm:ml-5 space-y-2 overflow-x-hidden max-w-full">
                          {hook.data.tool_input && (
                            <div className="overflow-x-hidden">
                              <div className="text-[10px] text-white/40 mb-1">Input:</div>
                              <pre className="bg-black/30 p-1 sm:p-2 rounded text-[9px] sm:text-[10px] overflow-x-auto border border-white/10 max-w-full">
                                <code className="text-cyan-400/80 break-all whitespace-pre-wrap">{JSON.stringify(hook.data.tool_input, null, isMobile ? 1 : 2)}</code>
                              </pre>
                            </div>
                          )}
                          {hook.data.result && (
                            <div className="overflow-x-hidden">
                              <div className="text-[10px] text-white/40 mb-1">Result:</div>
                              <pre className="bg-black/30 p-1 sm:p-2 rounded text-[9px] sm:text-[10px] overflow-x-auto max-h-24 sm:max-h-40 border border-white/10 max-w-full">
                                <code className="text-green-400/80 break-all whitespace-pre-wrap">{typeof hook.data.result === 'string' ? hook.data.result : JSON.stringify(hook.data.result, null, isMobile ? 1 : 2)}</code>
                              </pre>
                            </div>
                          )}
                          {hook.data.error && (
                            <div className="overflow-x-hidden">
                              <div className="text-[10px] text-red-400 mb-1">Error:</div>
                              <pre className="bg-red-900/20 p-1 sm:p-2 rounded text-[9px] sm:text-[10px] overflow-x-auto border border-red-500/20 max-w-full">
                                <code className="text-red-400 break-all whitespace-pre-wrap">{hook.data.error}</code>
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </motion.div>
                  )
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}