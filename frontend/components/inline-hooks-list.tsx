'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronRightIcon,
  CheckCircledIcon,
  CrossCircledIcon,
  ClockIcon,
  UpdateIcon
} from '@radix-ui/react-icons'
import { ChatHook } from '@/lib/api'
import { cn } from '@/lib/utils'
import ReactMarkdown from 'react-markdown'

interface InlineHooksListProps {
  hooks: ChatHook[]
  className?: string
}

export function InlineHooksList({ hooks, className }: InlineHooksListProps) {
  const [expandedHookIds, setExpandedHookIds] = useState<Set<string>>(new Set())

  const toggleHook = (hookId: string) => {
    setExpandedHookIds(prev => {
      const next = new Set(prev)
      if (next.has(hookId)) {
        next.delete(hookId)
      } else {
        next.add(hookId)
      }
      return next
    })
  }

  if (!hooks || hooks.length === 0) {
    return null
  }

  return (
    <div className={cn("space-y-2", className)}>
      {hooks.map((hook: ChatHook, hookIdx: number) => {
        const hookId = hook.id || `hook-${hookIdx}`
        const isHookExpanded = expandedHookIds.has(hookId)

        return (
          <div
            key={hookId}
            className={cn(
              "rounded-md border text-xs overflow-hidden transition-all",
              hook.status === 'completed' && "border-green-500/20",
              hook.status === 'processing' && "border-cyan-500/20",
              hook.status === 'pending' && "border-border/30",
              hook.status === 'failed' && "border-red-500/20"
            )}
          >
            {/* Hook Header - Clickable */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                toggleHook(hookId)
              }}
              className={cn(
                "w-full p-2 flex items-center gap-2 transition-colors",
                hook.status === 'completed' && "bg-green-500/10 hover:bg-green-500/15",
                hook.status === 'processing' && "bg-cyan-500/10 hover:bg-cyan-500/15",
                hook.status === 'pending' && "bg-muted/30 hover:bg-muted/40",
                hook.status === 'failed' && "bg-red-500/10 hover:bg-red-500/15"
              )}
            >
              {/* Expand Icon */}
              <motion.div
                animate={{ rotate: isHookExpanded ? 90 : 0 }}
                transition={{ duration: 0.15 }}
                className="flex-shrink-0"
              >
                <ChevronRightIcon className="h-3 w-3 text-muted-foreground" />
              </motion.div>

              {/* Status Icon */}
              {hook.status === 'completed' ? (
                <CheckCircledIcon className="h-3 w-3 text-green-400 flex-shrink-0" />
              ) : hook.status === 'processing' ? (
                <UpdateIcon className="h-3 w-3 text-cyan-400 animate-spin flex-shrink-0" />
              ) : hook.status === 'failed' ? (
                <CrossCircledIcon className="h-3 w-3 text-red-400 flex-shrink-0" />
              ) : (
                <ClockIcon className="h-3 w-3 text-muted-foreground flex-shrink-0" />
              )}

              {/* Hook Type */}
              <span className="font-medium text-foreground truncate">
                {hook.hook_type || 'Hook'}
              </span>

              {/* Tool Name Badge if available */}
              {(hook.tool_name || hook.data?.tool_name) && (
                <span className="px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground text-[10px] truncate max-w-[100px]">
                  {hook.tool_name || hook.data?.tool_name}
                </span>
              )}

              {/* Preview when collapsed - prioritize data.result */}
              {!isHookExpanded && (
                <span className="text-muted-foreground text-[10px] truncate flex-1 text-left max-w-[200px]">
                  {(() => {
                    // Priority: data.result > data.error > message
                    const preview = hook.data?.result || hook.data?.error || hook.message || ''
                    if (!preview) return null
                    const truncated = typeof preview === 'string' ? preview.substring(0, 60) : ''
                    return truncated.length < (preview?.length || 0) ? `${truncated}...` : truncated
                  })()}
                </span>
              )}

              {/* Status Badge */}
              <span className={cn(
                "ml-auto px-1.5 py-0.5 rounded text-[10px] font-medium flex-shrink-0",
                hook.status === 'completed' && "bg-green-500/20 text-green-400",
                hook.status === 'processing' && "bg-cyan-500/20 text-cyan-400",
                hook.status === 'pending' && "bg-muted/50 text-muted-foreground",
                hook.status === 'failed' && "bg-red-500/20 text-red-400",
                hook.status === 'user_message' && "bg-purple-500/20 text-purple-400"
              )}>
                {hook.status}
              </span>
            </button>

            {/* Expanded Content */}
            <AnimatePresence>
              {isHookExpanded && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.15 }}
                  className="overflow-hidden"
                >
                  <div className={cn(
                    "p-3 border-t space-y-2",
                    hook.status === 'completed' && "bg-green-500/5 border-green-500/20",
                    hook.status === 'processing' && "bg-cyan-500/5 border-cyan-500/20",
                    hook.status === 'pending' && "bg-muted/20 border-border/30",
                    hook.status === 'failed' && "bg-red-500/5 border-red-500/20"
                  )}>
                    {/* Result/Message Content - Prioritize hook.data.result */}
                    {(() => {
                      // Priority: data.result > data.error > message
                      const displayContent = hook.data?.result || hook.data?.error || hook.message
                      if (!displayContent) return null
                      return (
                        <div>
                          <div className="text-[10px] font-medium text-muted-foreground mb-1">
                            {hook.data?.error ? 'Error:' : 'Result:'}
                          </div>
                          <div className={cn(
                            "text-xs break-words p-2 rounded max-h-[300px] overflow-auto",
                            hook.data?.error
                              ? "text-red-400 bg-red-500/10"
                              : "text-foreground bg-muted/20"
                          )}>
                            {hook.data?.error ? (
                              <pre className="whitespace-pre-wrap">{displayContent}</pre>
                            ) : (
                              <div className="prose prose-xs prose-invert max-w-none prose-pre:bg-black/30 prose-pre:text-[10px] prose-code:text-[10px]">
                                <ReactMarkdown>{typeof displayContent === 'string' ? displayContent : JSON.stringify(displayContent, null, 2)}</ReactMarkdown>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })()}

                    {/* Tool Input if available */}
                    {(hook.tool_input || hook.data?.tool_input) && (
                      <div>
                        <div className="text-[10px] font-medium text-muted-foreground mb-1">Tool Input:</div>
                        <pre className="text-[10px] text-foreground bg-muted/30 p-2 rounded overflow-x-auto max-h-[150px]">
                          {(() => {
                            const toolInput = hook.tool_input || hook.data?.tool_input
                            return typeof toolInput === 'string'
                              ? toolInput
                              : JSON.stringify(toolInput, null, 2)
                          })()}
                        </pre>
                      </div>
                    )}

                    {/* Step Info if available */}
                    {(hook.step_name || hook.step_index !== undefined) && (
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span className="font-medium">Step:</span>
                        {hook.step_name && <span>{hook.step_name}</span>}
                        {hook.step_index !== undefined && hook.total_steps && (
                          <span className="ml-auto">({hook.step_index + 1}/{hook.total_steps})</span>
                        )}
                      </div>
                    )}

                    {/* Task ID if available */}
                    {hook.data?.task_id && (
                      <div className="text-[10px] text-muted-foreground">
                        <span className="font-medium">Task ID:</span> <code className="text-cyan-400">{hook.data.task_id.slice(0, 8)}...</code>
                      </div>
                    )}

                    {/* Timestamp */}
                    {hook.received_at && (
                      <div className="text-[10px] text-muted-foreground">
                        Received: {new Date(hook.received_at).toLocaleString()}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}
    </div>
  )
}
