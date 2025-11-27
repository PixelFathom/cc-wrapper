'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { InfoCircledIcon, ChevronRightIcon, UpdateIcon, CheckCircledIcon, CrossCircledIcon, CircleIcon } from '@radix-ui/react-icons'
import { api, ChatHook } from '@/lib/api'
import { Badge } from './ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible'
import { cn } from '@/lib/utils'

interface MessageHooksProps {
  messageId: string
  isProcessing?: boolean
  showByDefault?: boolean
}

export function MessageHooks({ messageId, isProcessing = false, showByDefault = false }: MessageHooksProps) {
  // Always start collapsed for cleaner UI, only show when actively processing
  const [isOpen, setIsOpen] = useState(isProcessing && showByDefault)

  // Fetch hooks for this message
  const { data: hooksData, isLoading } = useQuery({
    queryKey: ['message-hooks', messageId],
    queryFn: () => api.getMessageHooks(messageId),
    enabled: !!messageId,
    refetchInterval: isProcessing ? 3000 : false, // Poll every 3 seconds only when processing
  })

  const hooks = hooksData?.hooks || []
  
  // Check if we have a result message
  const resultHook = hooks.find(h => 
    (h.hook_type === 'status' && h.status === 'completed' && h.content_type === 'result') ||
    (h.message_type === 'ResultMessage' && h.content_type === 'result')
  )

  // Only auto-open when actively processing and showByDefault is true
  useEffect(() => {
    if (isProcessing && showByDefault) {
      setIsOpen(true)
    } else if (!isProcessing) {
      // Auto-collapse when processing is complete
      setIsOpen(false)
    }
  }, [isProcessing, showByDefault])

  // Don't render anything if no hooks
  if (!hooks.length && !isLoading) {
    return null
  }

  // Filter out the final result message and query_initiated from thinking steps
  const thinkingHooks = hooks.filter(h => 
    !(h.hook_type === 'status' && h.status === 'completed' && h.content_type === 'result') &&
    !(h.message_type === 'ResultMessage' && h.content_type === 'result') &&
    h.hook_type !== 'query_initiated'
  )

  // Don't show if no meaningful hooks
  if (thinkingHooks.length === 0 && !isLoading) {
    return null
  }

  const completedCount = thinkingHooks.filter(h => h.status === 'completed' || h.is_complete).length

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="mt-3"
    >
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="flex items-center space-x-2 text-xs text-cyan-400 hover:text-cyan-300 transition-colors group w-full sm:w-auto">
          <div className="flex items-center space-x-1 sm:space-x-2 bg-cyan-500/10 rounded-md px-2 py-1 border border-cyan-500/20 w-full sm:w-auto justify-center sm:justify-start">
            <InfoCircledIcon className="h-3 w-3 flex-shrink-0" />
            <span className="font-mono hidden sm:inline">Processing Steps</span>
            <span className="font-mono sm:hidden">Steps</span>
            {(isProcessing || isLoading) && (
              <CircleIcon className="h-3 w-3 text-yellow-500 flex-shrink-0" />
            )}
            {thinkingHooks.length > 0 && (
              <Badge variant="outline" className="text-xs px-1 py-0 ml-1 sm:ml-2 flex-shrink-0">
                {thinkingHooks.length}
              </Badge>
            )}
            <ChevronRightIcon className="h-3 w-3 transition-transform group-data-[state=open]:rotate-90 flex-shrink-0" />
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-2 ml-2 sm:ml-4 space-y-1.5 border-l-2 border-cyan-500/20 pl-2 sm:pl-4">
            {isLoading && (
              <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                <UpdateIcon className="h-3 w-3 animate-spin" />
                <span className="hidden sm:inline">Loading thinking steps...</span>
                <span className="sm:hidden">Loading...</span>
              </div>
            )}
            {thinkingHooks.map((hook, index) => {
              const isCompleted = hook.status === 'completed' || hook.is_complete
              const isFailed = hook.status === 'failed' || hook.status === 'error'
              const isHookProcessing = hook.status === 'processing' && !isCompleted
              
              // Determine display content based on webhook type
              let displayContent = ''
              let displayDetail = ''
              if (hook.content_type === 'tool_use') {
                displayContent = `${hook.tool_name || 'Tool'}`
                if (hook.tool_input?.command) {
                  displayDetail = hook.tool_input.command
                } else if (hook.tool_input?.pattern) {
                  displayDetail = `Search: ${hook.tool_input.pattern}`
                } else if (hook.tool_input?.file_path) {
                  displayDetail = hook.tool_input.file_path
                } else if (hook.tool_input?.prompt) {
                  displayDetail = hook.tool_input.prompt.substring(0, 100) + '...'
                }
              } else if (hook.content_type === 'tool_result') {
                displayContent = 'Result'
                if (hook.data?.result || hook.message) {
                  const result = hook.data?.result || hook.message || ''
                  // Show first few lines of result
                  const lines = result.split('\n').filter(Boolean).slice(0, 3)
                  displayDetail = lines.join('\n')
                  if (result.split('\n').length > 3) {
                    displayDetail += '\n...'
                  }
                }
              } else if (hook.content_type === 'text' && hook.message_type === 'AssistantMessage') {
                displayContent = 'Thinking'
                displayDetail = hook.data?.result || hook.message || 'Processing...'
              } else if (hook.status === 'user_message') {
                displayContent = 'User Message'
                displayDetail = hook.data?.result || hook.message || ''
              } else if (hook.status === 'processing') {
                displayContent = 'Processing'
                displayDetail = hook.message || 'Working on your request...'
              } else {
                displayContent = hook.step_name || hook.hook_type || 'Step'
                displayDetail = hook.message || ''
              }
              
              console.log(hook.content_type, displayDetail);
              console.log(hook);
              console.log(hook.data);
              // Hide content for SystemMessage types
              if (hook.message_type === 'SystemMessage') {
                displayDetail = ''
              }
              
              return (
                <motion.div
                  key={hook.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={cn(
                    "flex items-start space-x-2 text-xs p-2 rounded-md transition-all",
                    isCompleted && "bg-green-500/5 border-l-2 border-green-500 -ml-[2px]",
                    isFailed && "bg-red-500/5 border-l-2 border-red-500 -ml-[2px]",
                    isHookProcessing && "bg-yellow-500/5 border-l-2 border-yellow-500 -ml-[2px]",
                    !isCompleted && !isFailed && !isHookProcessing && "bg-muted/30"
                  )}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {isCompleted && <CheckCircledIcon className="h-3.5 w-3.5 text-green-500" />}
                    {isFailed && <CrossCircledIcon className="h-3.5 w-3.5 text-red-500" />}
                    {isHookProcessing && <CircleIcon className="h-3.5 w-3.5 text-yellow-500" />}
                    {!isCompleted && !isFailed && !isHookProcessing && <CircleIcon className="h-3.5 w-3.5 text-muted-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-xs">
                      <div className="flex flex-col gap-1">
                        <span className={cn(
                          "font-semibold",
                          isCompleted && "text-green-400",
                          isFailed && "text-red-400",
                          isHookProcessing && "text-yellow-400",
                          !isCompleted && !isFailed && !isHookProcessing && "text-muted-foreground"
                        )}>
                          {displayContent}
                        </span>
                        {displayDetail && (
                          <span className={cn(
                            "text-xs break-words whitespace-pre-wrap",
                            isCompleted && "text-green-400/70",
                            isFailed && "text-red-400/70",
                            isHookProcessing && "text-yellow-400/70",
                            !isCompleted && !isFailed && !isHookProcessing && "text-muted-foreground/70"
                          )}>
                            {/* {displayDetail} */}
                          </span>
                        )}
                        {hook.data?.error && (
                          <div className="mt-1 text-red-400/80 text-xs">
                            {hook.data.error}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </motion.div>
  )
}