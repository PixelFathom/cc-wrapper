'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api, ChatHook } from '@/lib/api'
import { MessageHooks } from './message-hooks'
import { UpdateIcon, CircleIcon, ChevronDownIcon, DotFilledIcon } from '@radix-ui/react-icons'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { useMobile } from '@/lib/hooks/useMobile'

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
  const [showHooks, setShowHooks] = useState(false)
  const isMobile = useMobile(768)

  // Close hooks by default on mobile for better UX
  useEffect(() => {
    if (isMobile && showHooks && hooks.length > 3) {
      setShowHooks(false)
    }
  }, [isMobile, hooks.length, showHooks])
  
  // Extract content from message
  const content = message.content?.text || ''
  const metadata = message.content?.metadata || {}
  const isProcessing = message.isProcessing || metadata.status === 'processing'
  
  // Show content if we have it and it's not just processing text
  const hasContent = content && content !== '' && !content.includes('Processing')
  const hasHooks = hooks.length > 0
  
  return (
    <div className="space-y-3">
      {/* Main content */}
      <div className="space-y-2">
        {hasContent ? (
          <div className="whitespace-pre-wrap text-foreground leading-relaxed break-words overflow-hidden">
            {content}
          </div>
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
      
      {/* Processing Steps / Hooks */}
      {hasHooks && (
        <div className="space-y-2">
          <button
            onClick={() => setShowHooks(!showHooks)}
            className="flex items-center space-x-2 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors bg-muted/20 px-2 py-1 rounded-md w-full sm:w-auto justify-center sm:justify-start"
          >
            <ChevronDownIcon className={cn(
              "h-3 w-3 transition-transform flex-shrink-0",
              showHooks && "rotate-180"
            )} />
            <span className="truncate">
              {isMobile ? 'Steps' : 'Processing Steps'}
            </span>
            <span className="text-purple-400 font-semibold flex-shrink-0">({hooks.length})</span>
          </button>
          
          <AnimatePresence>
            {showHooks && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-2 ml-2 sm:ml-4 border-l-2 border-purple-500/30 pl-2 sm:pl-4 overflow-hidden"
              >
                {hooks.map((hook, index) => {
                  const isExpanded = expandedHooks?.has(hook.id) || false
                  
                  return (
                    <motion.div
                      key={hook.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
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
                        <div className="mt-2 ml-3 sm:ml-5 space-y-2 overflow-hidden">
                          {hook.data.tool_input && (
                            <div>
                              <div className="text-[10px] text-white/40 mb-1">Input:</div>
                              <pre className="bg-black/30 p-1 sm:p-2 rounded text-[9px] sm:text-[10px] overflow-x-auto border border-white/10 max-w-full">
                                <code className="text-cyan-400/80 break-words whitespace-pre-wrap">{JSON.stringify(hook.data.tool_input, null, isMobile ? 1 : 2)}</code>
                              </pre>
                            </div>
                          )}
                          {hook.data.result && (
                            <div>
                              <div className="text-[10px] text-white/40 mb-1">Result:</div>
                              <pre className="bg-black/30 p-1 sm:p-2 rounded text-[9px] sm:text-[10px] overflow-x-auto max-h-24 sm:max-h-40 border border-white/10 max-w-full">
                                <code className="text-green-400/80 break-words whitespace-pre-wrap">{typeof hook.data.result === 'string' ? hook.data.result : JSON.stringify(hook.data.result, null, isMobile ? 1 : 2)}</code>
                              </pre>
                            </div>
                          )}
                          {hook.data.error && (
                            <div>
                              <div className="text-[10px] text-red-400 mb-1">Error:</div>
                              <pre className="bg-red-900/20 p-1 sm:p-2 rounded text-[9px] sm:text-[10px] overflow-x-auto border border-red-500/20 max-w-full">
                                <code className="text-red-400 break-words whitespace-pre-wrap">{hook.data.error}</code>
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