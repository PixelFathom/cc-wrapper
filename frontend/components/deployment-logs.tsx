'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { DeploymentHook } from '@/lib/api'
import { cn } from '@/lib/utils'
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
  showPhaseFilter?: boolean  // Whether to show phase filter tabs (default: true)
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

export function DeploymentLogs({ hooks, isCompleted, status, showPhaseFilter = true }: DeploymentLogsProps) {
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set())
  const [expandedHooks, setExpandedHooks] = useState<Set<string>>(new Set())
  const [selectedPhase, setSelectedPhase] = useState<'all' | 'initialization' | 'deployment'>('all')

  // Separate hooks by phase
  const hooksByPhase = useMemo(() => {
    const initialization = hooks.filter(h => h.phase === 'initialization')
    const deployment = hooks.filter(h => h.phase === 'deployment')
    return { initialization, deployment }
  }, [hooks])

  // Filter hooks based on selected phase (only if phase filter is enabled)
  const filteredHooks = useMemo(() => {
    if (!showPhaseFilter) return hooks  // If filter is disabled, show all provided hooks
    if (selectedPhase === 'all') return hooks
    return hooks.filter(h => h.phase === selectedPhase)
  }, [hooks, selectedPhase, showPhaseFilter])

  // Group hooks by logical steps
  const groupedHooks = useMemo(() => {
    const groups = new Map<string, GroupedHooks>()
    const groupOrder: string[] = []
    
    // Don't filter out any hooks - we want to see everything
    filteredHooks.forEach(hook => {
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
  }, [filteredHooks])

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
      <div className="space-y-4">
        {/* Tool Input */}
        {data.tool_input && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              <CodeIcon className="h-3 w-3" />
              Tool Input
            </div>
            <div className="bg-black/50 rounded-lg border border-border/50 overflow-hidden">
              <pre className="text-xs p-4 overflow-x-auto">
                <code className="text-gray-300 font-mono">
                  {typeof data.tool_input === 'string' 
                    ? data.tool_input 
                    : JSON.stringify(data.tool_input, null, 2)}
                </code>
              </pre>
            </div>
          </div>
        )}
        
        {/* Result Display */}
        {data.result && typeof data.result === 'string' && data.result.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              <CheckCircledIcon className="h-3 w-3 text-green-500" />
              Output
            </div>
            <div className="bg-black/30 rounded-lg border border-border/50 overflow-hidden">
              <pre className="text-xs p-4 overflow-x-auto max-h-96 overflow-y-auto">
                <code className="text-gray-300 font-mono whitespace-pre-wrap break-words">
                  {data.result}
                </code>
              </pre>
            </div>
          </div>
        )}
        
        {/* Error Display */}
        {data.error && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-red-400 uppercase tracking-wide">
              <CrossCircledIcon className="h-3 w-3" />
              Error
            </div>
            <div className="bg-red-900/20 rounded-lg border border-red-500/30 overflow-hidden">
              <pre className="text-xs p-4 overflow-x-auto">
                <code className="text-red-300 font-mono whitespace-pre-wrap break-words">
                  {data.error}
                </code>
              </pre>
            </div>
          </div>
        )}
        
        {/* Metadata */}
        {data.metadata && Object.keys(data.metadata).length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              <GearIcon className="h-3 w-3" />
              Metadata
            </div>
            <div className="bg-black/30 rounded-lg border border-border/50 overflow-hidden">
              <pre className="text-xs p-4 overflow-x-auto">
                <code className="text-gray-300 font-mono">
                  {JSON.stringify(data.metadata, null, 2)}
                </code>
              </pre>
            </div>
          </div>
        )}
        
        {/* Usage Stats */}
        {data.usage && (data.usage.input_tokens || data.usage.output_tokens) && (
          <div className="flex flex-wrap gap-4 p-3 bg-muted/30 rounded-lg border border-border/50">
            {data.usage.input_tokens && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Input:</span>
                <span className="text-xs font-mono font-semibold text-cyan-400">
                  {data.usage.input_tokens.toLocaleString()} tokens
                </span>
              </div>
            )}
            {data.usage.output_tokens && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Output:</span>
                <span className="text-xs font-mono font-semibold text-cyan-400">
                  {data.usage.output_tokens.toLocaleString()} tokens
                </span>
              </div>
            )}
            {data.total_cost_usd && data.total_cost_usd > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Cost:</span>
                <span className="text-xs font-mono font-semibold text-green-400">
                  ${data.total_cost_usd.toFixed(6)}
                </span>
              </div>
            )}
            {data.duration_ms && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Duration:</span>
                <span className="text-xs font-mono font-semibold text-yellow-400">
                  {data.duration_ms}ms
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden bg-card">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-gradient-to-r from-card/50 to-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RocketIcon className="h-4 w-4 text-cyan-400" />
            <h3 className="text-base font-semibold text-foreground">Deployment Logs</h3>
            {!showPhaseFilter && (
              <span className="text-xs text-muted-foreground font-mono px-2 py-0.5 bg-muted/50 rounded">
                {filteredHooks.length} {filteredHooks.length === 1 ? 'event' : 'events'}
              </span>
            )}
          </div>
          {showPhaseFilter && (
            <div className="flex items-center gap-3">
              {/* Phase Filter Tabs */}
              <div className="flex items-center gap-1 bg-muted/50 rounded-md p-1 border border-border/50">
                <button
                  onClick={() => setSelectedPhase('all')}
                  className={`px-3 py-1.5 text-xs font-medium rounded transition-all ${
                    selectedPhase === 'all'
                      ? 'bg-background text-foreground shadow-sm border border-border/50'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
                  }`}
                >
                  All ({hooks.length})
                </button>
                <button
                  onClick={() => setSelectedPhase('initialization')}
                  className={`px-3 py-1.5 text-xs font-medium rounded transition-all ${
                    selectedPhase === 'initialization'
                      ? 'bg-background text-foreground shadow-sm border border-border/50'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
                  }`}
                >
                  Initialization ({hooksByPhase.initialization.length})
                </button>
                <button
                  onClick={() => setSelectedPhase('deployment')}
                  className={`px-3 py-1.5 text-xs font-medium rounded transition-all ${
                    selectedPhase === 'deployment'
                      ? 'bg-background text-foreground shadow-sm border border-border/50'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
                  }`}
                >
                  Deployment ({hooksByPhase.deployment.length})
                </button>
              </div>
            </div>
          )}
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
                      className={cn(
                        "w-full text-left group rounded-lg p-3 transition-all border",
                        group.status === 'completed' 
                          ? "bg-green-500/5 border-green-500/20 hover:bg-green-500/10"
                          : group.status === 'error'
                          ? "bg-red-500/5 border-red-500/20 hover:bg-red-500/10"
                          : "bg-muted/30 border-border/50 hover:bg-muted/50"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        {/* Status Icon */}
                        <div className={cn(
                          "p-2 rounded-lg flex-shrink-0",
                          group.status === 'completed'
                            ? "bg-green-500/20"
                            : group.status === 'error'
                            ? "bg-red-500/20"
                            : "bg-blue-500/20"
                        )}>
                          {group.status === 'completed' ? (
                            <CheckCircledIcon className="h-5 w-5 text-green-500" />
                          ) : group.status === 'error' ? (
                            <CrossCircledIcon className="h-5 w-5 text-red-500" />
                          ) : isCurrentlyRunning ? (
                            <UpdateIcon className="h-5 w-5 text-yellow-500 animate-spin" />
                          ) : (
                            <ClockIcon className="h-5 w-5 text-gray-500" />
                          )}
                        </div>
                        
                        {/* Job Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold text-base">{group.stepName}</h4>
                            <div className="transition-transform group-hover:translate-x-0.5">
                              {isExpanded ? 
                                <ChevronDownIcon className="h-4 w-4 text-muted-foreground" /> : 
                                <ChevronRightIcon className="h-4 w-4 text-muted-foreground" />
                              }
                            </div>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <CubeIcon className="h-3 w-3" />
                              {group.hooks.length} {group.hooks.length === 1 ? 'event' : 'events'}
                            </span>
                            <span className="flex items-center gap-1">
                              <ClockIcon className="h-3 w-3" />
                              {formatDuration(group.startTime, group.endTime)}
                            </span>
                            {group.totalCost && group.totalCost > 0 && (
                              <span className="flex items-center gap-1 text-green-400">
                                ${group.totalCost.toFixed(4)}
                              </span>
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
                          <div className="mt-3 ml-8 space-y-2">
                            {group.hooks.map((hook, hookIndex) => {
                              const hasDetails = hook.data && (
                                hook.data.tool_input || 
                                hook.data.result || 
                                hook.data.error ||
                                (hook.data.metadata && Object.keys(hook.data.metadata).length > 0) ||
                                hook.data.usage
                              )
                              const isHookExpanded = expandedHooks.has(hook.id)
                              const isError = hook.status === 'ERROR' || hook.status === 'FAILED' || hook.data?.error
                              const isCompleted = hook.is_complete || hook.status === 'COMPLETED'
                              
                              return (
                                <div 
                                  key={hook.id} 
                                  className={cn(
                                    "relative rounded-lg border transition-all",
                                    isError 
                                      ? "bg-red-500/5 border-red-500/20 hover:bg-red-500/10" 
                                      : isCompleted
                                      ? "bg-green-500/5 border-green-500/20 hover:bg-green-500/10"
                                      : "bg-muted/30 border-border/50 hover:bg-muted/50"
                                  )}
                                >
                                  {/* Timeline connector */}
                                  {hookIndex < group.hooks.length - 1 && (
                                    <div className="absolute left-6 top-10 w-0.5 h-full bg-border/30" />
                                  )}
                                  
                                  <div className="p-3">
                                    <div className="flex items-start gap-3">
                                      {/* Status Icon with better styling */}
                                      <div className={cn(
                                        "mt-0.5 p-1.5 rounded-full flex-shrink-0",
                                        isError 
                                          ? "bg-red-500/20" 
                                          : isCompleted
                                          ? "bg-green-500/20"
                                          : "bg-blue-500/20"
                                      )}>
                                        {isCompleted ? (
                                          <CheckCircledIcon className="h-4 w-4 text-green-500" />
                                        ) : isError ? (
                                          <CrossCircledIcon className="h-4 w-4 text-red-500" />
                                        ) : hook.data?.message_type === 'AssistantMessage' ? (
                                          <ChatBubbleIcon className="h-4 w-4 text-blue-500" />
                                        ) : hook.data?.message_type === 'SystemMessage' ? (
                                          <GearIcon className="h-4 w-4 text-purple-500" />
                                        ) : hook.data?.tool_name ? (
                                          <CodeIcon className="h-4 w-4 text-cyan-500" />
                                        ) : (
                                          <DotFilledIcon className="h-4 w-4 text-gray-400" />
                                        )}
                                      </div>
                                      
                                      <div className="flex-1 min-w-0">
                                        {/* Main message */}
                                        <div className="flex items-start justify-between gap-3">
                                          <div className="flex-1 min-w-0">
                                            <div className={cn(
                                              "text-sm font-medium mb-1",
                                              isError ? "text-red-400" : "text-foreground"
                                            )}>
                                              {hook.message || hook.data?.message || hook.data?.step_name || hook.status}
                                            </div>
                                            
                                            {/* Tool name badge */}
                                            {hook.data?.tool_name && (
                                              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-cyan-500/10 border border-cyan-500/20 mb-2">
                                                {getToolIcon(hook.data.tool_name)}
                                                <span className="text-xs font-mono text-cyan-400">
                                                  {hook.data.tool_name}
                                                </span>
                                              </div>
                                            )}
                                            
                                            {/* Metadata row */}
                                            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                                              <span className="font-mono flex items-center gap-1">
                                                <ClockIcon className="h-3 w-3" />
                                                {formatTimestamp(hook.received_at)}
                                              </span>
                                              {hook.data?.duration_ms && (
                                                <span className="flex items-center gap-1">
                                                  <LightningBoltIcon className="h-3 w-3" />
                                                  {hook.data.duration_ms}ms
                                                </span>
                                              )}
                                              {hook.data?.total_cost_usd && hook.data.total_cost_usd > 0 && (
                                                <span className="flex items-center gap-1 text-green-400">
                                                  ${hook.data.total_cost_usd.toFixed(4)}
                                                </span>
                                              )}
                                            </div>
                                            
                                            {/* Error message preview */}
                                            {hook.data?.error && (
                                              <div className="mt-2 p-2 rounded bg-red-500/10 border border-red-500/20">
                                                <p className="text-xs text-red-300 font-mono line-clamp-2">
                                                  {hook.data.error}
                                                </p>
                                              </div>
                                            )}
                                            
                                            {/* Result preview (truncated) */}
                                            {hook.data?.result && typeof hook.data.result === 'string' && !isHookExpanded && (
                                              <div className="mt-2 p-2 rounded bg-black/30 border border-border/50">
                                                <p className="text-xs text-muted-foreground font-mono line-clamp-3">
                                                  {hook.data.result}
                                                </p>
                                              </div>
                                            )}
                                          </div>
                                          
                                          {hasDetails && (
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation()
                                                toggleHook(hook.id)
                                              }}
                                              className={cn(
                                                "text-xs px-3 py-1.5 rounded-md border transition-colors flex-shrink-0",
                                                isHookExpanded
                                                  ? "bg-blue-500/20 border-blue-500/30 text-blue-400"
                                                  : "bg-muted/50 border-border/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                                              )}
                                            >
                                              {isHookExpanded ? 'Hide' : 'View'} Details
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
                                              className="overflow-hidden mt-3 pt-3 border-t border-border/50"
                                            >
                                              {formatWebhookData(hook)}
                                            </motion.div>
                                          )}
                                        </AnimatePresence>
                                      </div>
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