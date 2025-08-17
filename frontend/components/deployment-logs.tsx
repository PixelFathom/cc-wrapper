'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { DeploymentHook } from '@/lib/api'
import { 
  CheckCircledIcon, CrossCircledIcon, UpdateIcon, RocketIcon, 
  ChevronDownIcon, ChevronRightIcon, CodeIcon, CubeIcon, 
  GitHubLogoIcon, GearIcon, FileTextIcon, PersonIcon,
  ChatBubbleIcon, ClockIcon, LightningBoltIcon, DotFilledIcon
} from '@radix-ui/react-icons'

interface DeploymentLogsProps {
  hooks: DeploymentHook[]
  isCompleted?: boolean
  status?: string
}

interface GroupedHooks {
  stepName: string
  hooks: DeploymentHook[]
  status: 'completed' | 'error' | 'running' | 'pending'
  startTime: string
  endTime?: string
  isLastStep?: boolean
  hookType?: string
  totalDuration?: number
  totalCost?: number
}

export function DeploymentLogs({ hooks, isCompleted, status }: DeploymentLogsProps) {
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set())
  const [expandedHooks, setExpandedHooks] = useState<Set<string>>(new Set())

  // Group hooks by logical steps
  const groupedHooks = useMemo(() => {
    const groups = new Map<string, GroupedHooks>()
    const groupOrder: string[] = []
    
    // Don't filter out any hooks - we want to see everything
    hooks.forEach(hook => {
      // Determine group key based on hook type and data
      let stepName = 'Initialization'
      
      if (hook.data?.step_name) {
        stepName = hook.data.step_name
      } else if (hook.hook_type === 'query') {
        // Group query hooks by their message type
        const messageType = hook.data?.message_type || 'Query'
        stepName = `AI Processing - ${messageType}`
      } else if (hook.hook_type === 'status') {
        stepName = hook.data?.step_name || 'Status Update'
      } else {
        stepName = hook.hook_type || 'Deployment Step'
      }
      
      if (!groups.has(stepName)) {
        groups.set(stepName, {
          stepName,
          hooks: [],
          status: 'running',
          startTime: hook.received_at,
          hookType: hook.hook_type
        })
        groupOrder.push(stepName)
      }
      
      const group = groups.get(stepName)!
      group.hooks.push(hook)
      
      // Update group status based on hook messages and status
      const hasError = group.hooks.some(h => 
        h.status === 'ERROR' || h.status === 'FAILED' || h.data?.error
      )
      
      // Check if step is completed - look for completion messages or status
      const hasCompleted = group.hooks.some(h => {
        // Check explicit completion status
        if (h.status === 'COMPLETED' || h.status === 'completed' || h.is_complete) {
          return true
        }
        // Check for completion messages in the step
        if (h.message && (
          h.message.includes('completed') || 
          h.message.includes('succeeded') ||
          h.message.includes('successfully') ||
          h.message.includes('✓')
        )) {
          return true
        }
        return false
      })
      
      if (hasError) {
        group.status = 'error'
        group.endTime = hook.received_at
      } else if (hasCompleted) {
        group.status = 'completed'
        if (!group.endTime) {
          group.endTime = hook.received_at
        }
      }
      
      // Calculate total duration and cost for the group
      const totalDuration = group.hooks.reduce((sum, h) => 
        sum + (h.data?.duration_ms || 0), 0
      )
      const totalCost = group.hooks.reduce((sum, h) => 
        sum + (h.data?.total_cost_usd || 0), 0
      )
      
      if (totalDuration > 0) group.totalDuration = totalDuration
      if (totalCost > 0) group.totalCost = totalCost
    })
    
    // Post-process: Mark previous steps as completed if a new step has started
    const groupArray = groupOrder.map(name => groups.get(name)!)
    for (let i = 0; i < groupArray.length - 1; i++) {
      const currentGroup = groupArray[i]
      const nextGroup = groupArray[i + 1]
      
      // If the next group has started (has hooks) and current is still running, 
      // mark current as completed
      if (nextGroup.hooks.length > 0 && currentGroup.status === 'running') {
        currentGroup.status = 'completed'
        if (!currentGroup.endTime) {
          currentGroup.endTime = nextGroup.startTime
        }
      }
    }
    
    return groupArray
  }, [hooks])

  const getToolIcon = (toolName?: string) => {
    if (!toolName) return null
    
    const name = toolName.toLowerCase()
    switch(name) {
      case 'bash':
      case 'shell':
        return <CodeIcon className="h-3 w-3" />
      case 'github':
        return <GitHubLogoIcon className="h-3 w-3" />
      case 'read':
      case 'write':
      case 'edit':
        return <FileTextIcon className="h-3 w-3" />
      case 'todowrite':
        return <CheckCircledIcon className="h-3 w-3" />
      case 'ls':
      case 'glob':
      case 'grep':
        return <CubeIcon className="h-3 w-3" />
      default:
        return <GearIcon className="h-3 w-3" />
    }
  }

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit',
      hour12: false 
    })
  }

  const formatDuration = (start: string, end?: string) => {
    if (!end) return 'In progress...'
    const duration = new Date(end).getTime() - new Date(start).getTime()
    const seconds = Math.floor(duration / 1000)
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}m ${remainingSeconds}s`
  }

  const toggleStep = (stepName: string) => {
    const newExpanded = new Set(expandedSteps)
    if (newExpanded.has(stepName)) {
      newExpanded.delete(stepName)
    } else {
      newExpanded.add(stepName)
    }
    setExpandedSteps(newExpanded)
  }

  const toggleHook = (hookId: string) => {
    const newExpanded = new Set(expandedHooks)
    if (newExpanded.has(hookId)) {
      newExpanded.delete(hookId)
    } else {
      newExpanded.add(hookId)
    }
    setExpandedHooks(newExpanded)
  }

  const formatWebhookData = (hook: DeploymentHook) => {
    const data = hook.data
    if (!data) return null
    
    return (
      <div className="space-y-3 mt-2">
        {/* Tool Information */}
        {data.tool_name && (
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              {getToolIcon(data.tool_name)}
              <span className="text-cyan-400 font-medium text-sm">{data.tool_name}</span>
            </div>
            {data.tool_input && (
              <pre className="text-xs bg-black/50 p-3 rounded-lg overflow-x-auto border border-border">
                <code className="text-gray-300">{JSON.stringify(data.tool_input, null, 2)}</code>
              </pre>
            )}
          </div>
        )}
        
        {/* Result Display */}
        {data.result && typeof data.result === 'string' && data.result.length > 0 && (
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Result:</span>
            <pre className="text-xs bg-black/30 p-2 rounded overflow-x-auto max-h-40">
              <code className="text-gray-300">{data.result}</code>
            </pre>
          </div>
        )}
        
        {/* Error Display */}
        {data.error && (
          <div className="space-y-1">
            <span className="text-xs text-red-400">Error:</span>
            <pre className="text-xs bg-red-900/20 p-2 rounded overflow-x-auto border border-red-500/20">
              <code className="text-red-300">{data.error}</code>
            </pre>
          </div>
        )}
        
        {/* Metadata */}
        {data.metadata && Object.keys(data.metadata).length > 0 && (
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Metadata:</span>
            <pre className="text-xs bg-black/30 p-2 rounded overflow-x-auto">
              <code className="text-gray-300">{JSON.stringify(data.metadata, null, 2)}</code>
            </pre>
          </div>
        )}
        
        {/* Usage Stats */}
        {data.usage && (
          <div className="flex flex-wrap gap-4 text-xs">
            {data.usage.input_tokens && (
              <span className="text-muted-foreground">
                Input tokens: <span className="text-cyan-400">{data.usage.input_tokens}</span>
              </span>
            )}
            {data.usage.output_tokens && (
              <span className="text-muted-foreground">
                Output tokens: <span className="text-cyan-400">{data.usage.output_tokens}</span>
              </span>
            )}
            {data.total_cost_usd && (
              <span className="text-muted-foreground">
                Cost: <span className="text-green-400">${data.total_cost_usd.toFixed(4)}</span>
              </span>
            )}
            {data.duration_ms && (
              <span className="text-muted-foreground">
                Duration: <span className="text-yellow-400">{data.duration_ms}ms</span>
              </span>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden bg-card">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-medium">Jobs</h3>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <button className="hover:text-foreground transition-colors">
              Filter
            </button>
            <button className="hover:text-foreground transition-colors">
              Search logs
            </button>
          </div>
        </div>
      </div>

      {/* Jobs List */}
      <div className="relative">
        {groupedHooks.length === 0 ? (
          <div className="text-center py-12">
            <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <UpdateIcon className="h-4 w-4 animate-spin" />
              <span>Waiting for jobs to start...</span>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {groupedHooks.map((group, groupIndex) => {
              const isExpanded = expandedSteps.has(group.stepName)
              const isCurrentlyRunning = !isCompleted && group.status === 'running'
              
              return (
                <div key={group.stepName}>
                  <div className="p-4">
                    {/* Job Header */}
                    <button
                      onClick={() => toggleStep(group.stepName)}
                      className="w-full text-left group hover:bg-muted/30 rounded p-2 -m-2 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        {/* Status Icon */}
                        {group.status === 'completed' ? (
                          <CheckCircledIcon className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                        ) : group.status === 'error' ? (
                          <CrossCircledIcon className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                        ) : isCurrentlyRunning ? (
                          <div className="relative mt-0.5 flex-shrink-0">
                            <UpdateIcon className="h-5 w-5 text-yellow-500 animate-spin" />
                          </div>
                        ) : (
                          <ClockIcon className="h-5 w-5 text-gray-500 mt-0.5 flex-shrink-0" />
                        )}
                        
                        {/* Job Info */}
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{group.stepName}</h4>
                            <div className="transition-transform group-hover:translate-x-0.5">
                              {isExpanded ? 
                                <ChevronDownIcon className="h-4 w-4 text-muted-foreground" /> : 
                                <ChevronRightIcon className="h-4 w-4 text-muted-foreground" />
                              }
                            </div>
                          </div>
                          <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                            <span>{group.hooks.length} {group.hooks.length === 1 ? 'step' : 'steps'}</span>
                            <span>{formatDuration(group.startTime, group.endTime)}</span>
                            {group.totalCost && group.totalCost > 0 && (
                              <span>Cost: ${group.totalCost.toFixed(4)}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>

                    {/* Job Steps */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-3 ml-8 space-y-0 border-l-2 border-muted pl-4">
                            {group.hooks.map((hook, hookIndex) => {
                              const hasDetails = hook.data && (
                                hook.data.tool_input || 
                                hook.data.result || 
                                hook.data.error ||
                                (hook.data.metadata && Object.keys(hook.data.metadata).length > 0) ||
                                hook.data.usage
                              )
                              const isHookExpanded = expandedHooks.has(hook.id)
                              
                              return (
                                <div key={hook.id} className={`py-2 ${hookIndex < group.hooks.length - 1 ? 'border-b border-border/30' : ''}`}>
                                  <div className="flex items-start gap-2">
                                    {/* Step Status */}
                                    <div className="mt-0.5">
                                      {hook.is_complete || hook.status === 'COMPLETED' ? (
                                        <CheckCircledIcon className="h-4 w-4 text-green-500" />
                                      ) : hook.status === 'ERROR' || hook.status === 'FAILED' || hook.data?.error ? (
                                        <CrossCircledIcon className="h-4 w-4 text-red-500" />
                                      ) : hook.data?.message_type === 'AssistantMessage' ? (
                                        <ChatBubbleIcon className="h-4 w-4 text-blue-500" />
                                      ) : hook.data?.message_type === 'SystemMessage' ? (
                                        <GearIcon className="h-4 w-4 text-purple-500" />
                                      ) : (
                                        <DotFilledIcon className="h-4 w-4 text-gray-400" />
                                      )}
                                    </div>
                                    
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1">
                                          <div className="text-sm">
                                            {hook.message || hook.data?.message || hook.status}
                                          </div>
                                          
                                          {/* Step metadata */}
                                          <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                                            <span className="font-mono">{formatTimestamp(hook.received_at)}</span>
                                            {hook.data?.duration_ms && (
                                              <span>{hook.data.duration_ms}ms</span>
                                            )}
                                            {hook.data?.total_cost_usd && (
                                              <span>${hook.data.total_cost_usd.toFixed(4)}</span>
                                            )}
                                          </div>
                                        </div>
                                        
                                        {hasDetails && (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              toggleHook(hook.id)
                                            }}
                                            className="text-xs text-blue-500 hover:underline"
                                          >
                                            {isHookExpanded ? 'Hide' : 'View'} output
                                          </button>
                                        )}
                                      </div>
                                      
                                      {/* Expandable webhook data */}
                                      <AnimatePresence>
                                        {isHookExpanded && hasDetails && (
                                          <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className="overflow-hidden"
                                          >
                                            {formatWebhookData(hook)}
                                          </motion.div>
                                        )}
                                      </AnimatePresence>
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}