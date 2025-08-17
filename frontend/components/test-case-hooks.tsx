'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { InfoCircledIcon, ChevronRightIcon, UpdateIcon, CheckCircledIcon, CrossCircledIcon, CircleIcon } from '@radix-ui/react-icons'
import { api } from '@/lib/api'
import { Badge } from './ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible'
import { cn } from '@/lib/utils'

interface TestCaseHooksProps {
  testCaseId: string
  isProcessing?: boolean
  showByDefault?: boolean
}

export interface TestCaseHook {
  id: string
  hook_type: string
  status: string
  message?: string
  data: any
  is_complete: boolean
  received_at: string
  step_name?: string
  step_index?: number
  total_steps?: number
  message_type?: string
  content_type?: string
  tool_name?: string
  tool_input?: any
  conversation_id?: string
}

export function TestCaseHooks({ testCaseId, isProcessing = false, showByDefault = false }: TestCaseHooksProps) {
  // Always start collapsed for cleaner UI, only show when actively processing
  const [isOpen, setIsOpen] = useState(isProcessing && showByDefault)

  // Fetch hooks for this test case
  const { data: hooksData, isLoading, error } = useQuery({
    queryKey: ['test-case-hooks', testCaseId],
    queryFn: () => api.getTestCaseHooks(testCaseId),
    enabled: !!testCaseId,
    refetchInterval: (isProcessing || showByDefault) ? 2000 : false, // Poll every 2 seconds when processing or modal opened for running test
  })

  const hooks = hooksData?.hooks || []
  
  // Check if we have a result message
  const resultHook = hooks.find(h => 
    (h.hook_type === 'status' && h.status === 'completed' && h.content_type === 'result') ||
    (h.message_type === 'ResultMessage' && h.content_type === 'result')
  )

  // Auto-open when processing, showByDefault, or when we detect hooks appearing
  useEffect(() => {
    if (isProcessing || showByDefault || (hooks.length > 0)) {
      setIsOpen(true)
    } else if (!isProcessing && !showByDefault && hooks.length === 0) {
      // Auto-collapse when processing is complete and no hooks
      setIsOpen(false)
    }
  }, [isProcessing, showByDefault, hooks.length])

  // Always show if processing, loading, showByDefault (modal opened), or if we have hooks
  // Only hide if not processing, not loading, not explicitly shown, and no hooks
  if (!isProcessing && !isLoading && !showByDefault && !hooks.length) {
    return null
  }

  // Filter out the final result message and execution_initiated from thinking steps
  const thinkingHooks = hooks.filter(h => 
    !(h.hook_type === 'status' && h.status === 'completed' && h.content_type === 'result') &&
    !(h.message_type === 'ResultMessage' && h.content_type === 'result') &&
    h.hook_type !== 'execution_initiated'
  )

  // Show if processing, loading, showByDefault, or if we have meaningful hooks
  if (thinkingHooks.length === 0 && !isLoading && !isProcessing && !showByDefault) {
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
        <CollapsibleTrigger className="flex items-center space-x-2 text-xs text-blue-400 hover:text-blue-300 transition-colors group w-full sm:w-auto">
          <div className="flex items-center space-x-1 sm:space-x-2 bg-blue-500/10 rounded-md px-2 py-1 border border-blue-500/20 w-full sm:w-auto justify-center sm:justify-start">
            <InfoCircledIcon className="h-3 w-3 flex-shrink-0" />
            <span className="font-mono hidden sm:inline">Execution Steps</span>
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
          <div className="mt-2 ml-2 sm:ml-4 space-y-1.5 border-l-2 border-blue-500/20 pl-2 sm:pl-4 max-h-[40vh] overflow-y-auto">
            {(isLoading || (isProcessing && thinkingHooks.length === 0) || (showByDefault && thinkingHooks.length === 0)) && (
              <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                <UpdateIcon className="h-3 w-3 animate-spin" />
                <span className="hidden sm:inline">
                  {isProcessing || showByDefault ? 'Test case is executing... Waiting for execution steps...' : 'Loading execution steps...'}
                </span>
                <span className="sm:hidden">
                  {isProcessing || showByDefault ? 'Executing...' : 'Loading...'}
                </span>
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
                displayContent = 'Analyzing'
                displayDetail = hook.data?.result || hook.message || 'Processing test case...'
              } else if (hook.status === 'user_message') {
                displayContent = 'Test Case Received'
                displayDetail = hook.data?.result || hook.message || ''
              } else if (hook.status === 'processing') {
                displayContent = 'Executing'
                displayDetail = hook.message || 'Running test case...'
              } else {
                displayContent = hook.step_name || hook.hook_type || 'Step'
                displayDetail = hook.message || ''
              }
              
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
                            {displayDetail}
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