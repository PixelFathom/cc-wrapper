'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckCircledIcon,
  CrossCircledIcon,
  ClockIcon,
  UpdateIcon,
  ChevronRightIcon,
  ChevronDownIcon
} from '@radix-ui/react-icons'
import { cn } from '@/lib/utils'
import { SubTaskInfo } from '@/lib/api/task-breakdown'

interface TaskBreakdownTimelineProps {
  subTasks: SubTaskInfo[]
  totalTasks: number
  completedTasks: number
  currentTask: number
  onSubTaskClick?: (subTask: SubTaskInfo) => void
}

export function TaskBreakdownTimeline({
  subTasks,
  totalTasks,
  completedTasks,
  currentTask,
  onSubTaskClick
}: TaskBreakdownTimelineProps) {
  const [expandedTasks, setExpandedTasks] = useState<Set<number>>(new Set())
  
  // Auto-expand the current processing task
  useEffect(() => {
    if (currentTask >= 0 && currentTask < subTasks.length) {
      const taskSeq = subTasks[currentTask].sequence
      setExpandedTasks(prev => new Set(prev).add(taskSeq))
    }
  }, [currentTask, subTasks])
  
  const toggleExpand = (sequence: number) => {
    setExpandedTasks(prev => {
      const next = new Set(prev)
      if (next.has(sequence)) {
        next.delete(sequence)
      } else {
        next.add(sequence)
      }
      return next
    })
  }
  
  const getStatusIcon = (status: SubTaskInfo['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircledIcon className="h-5 w-5 text-green-500" />
      case 'processing':
        return <UpdateIcon className="h-5 w-5 text-cyan-500 animate-spin" />
      case 'failed':
        return <CrossCircledIcon className="h-5 w-5 text-red-500" />
      case 'pending':
      default:
        return <ClockIcon className="h-5 w-5 text-gray-500" />
    }
  }
  
  const getStatusColor = (status: SubTaskInfo['status']) => {
    switch (status) {
      case 'completed':
        return 'border-green-500 bg-green-500/10'
      case 'processing':
        return 'border-cyan-500 bg-cyan-500/10'
      case 'failed':
        return 'border-red-500 bg-red-500/10'
      case 'pending':
      default:
        return 'border-gray-500/30 bg-gray-500/5'
    }
  }
  
  const progressPercentage = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0
  
  return (
    <div className="w-full bg-card/50 backdrop-blur-sm rounded-lg border border-border/50 p-4">
      {/* Header with progress */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse" />
            <h3 className="text-sm font-semibold text-foreground">
              Task Breakdown Progress
            </h3>
          </div>
          <span className="text-xs text-muted-foreground">
            {completedTasks} of {totalTasks} completed
          </span>
        </div>
        
        {/* Progress bar */}
        <div className="w-full h-2 bg-muted/50 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-cyan-500 to-blue-500"
            initial={{ width: 0 }}
            animate={{ width: `${progressPercentage}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
      </div>
      
      {/* Timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border/30" />
        
        <div className="space-y-3">
          <AnimatePresence>
            {subTasks.map((subTask, index) => {
              const isExpanded = expandedTasks.has(subTask.sequence)
              const isLast = index === subTasks.length - 1
              
              return (
                <motion.div
                  key={subTask.sequence}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: index * 0.1 }}
                  className="relative"
                >
                  {/* Timeline node */}
                  <div className="flex items-start gap-3">
                    {/* Status icon circle */}
                    <div className={cn(
                      "relative z-10 flex-shrink-0 w-8 h-8 rounded-full border-2 flex items-center justify-center",
                      getStatusColor(subTask.status)
                    )}>
                      {getStatusIcon(subTask.status)}
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <button
                        onClick={() => {
                          toggleExpand(subTask.sequence)
                          onSubTaskClick?.(subTask)
                        }}
                        className={cn(
                          "w-full text-left p-3 rounded-lg border transition-all",
                          getStatusColor(subTask.status),
                          "hover:shadow-md hover:border-cyan-500/30"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            {/* Sequence and title */}
                            <div className="flex items-center gap-2 mb-1">
                              <span className="flex-shrink-0 text-xs font-mono font-bold text-muted-foreground">
                                {subTask.sequence}.
                              </span>
                              <h4 className="text-sm font-semibold text-foreground truncate">
                                {subTask.title}
                              </h4>
                            </div>
                            
                            {/* Description */}
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {subTask.description}
                            </p>
                            
                            {/* Timing info */}
                            {subTask.started_at && (
                              <div className="mt-2 text-xs text-muted-foreground/70">
                                Started: {new Date(subTask.started_at).toLocaleTimeString()}
                                {subTask.completed_at && (
                                  <span className="ml-2">
                                    • Completed: {new Date(subTask.completed_at).toLocaleTimeString()}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                          
                          {/* Expand icon */}
                          <motion.div
                            animate={{ rotate: isExpanded ? 90 : 0 }}
                            transition={{ duration: 0.2 }}
                            className="flex-shrink-0"
                          >
                            <ChevronRightIcon className="h-4 w-4 text-muted-foreground" />
                          </motion.div>
                        </div>
                      </button>
                      
                      {/* Expanded details */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                            className="mt-2 pl-3 border-l-2 border-border/30 ml-6"
                          >
                            <div className="p-3 bg-muted/30 rounded-md space-y-2">
                              {/* Full description */}
                              <div>
                                <div className="text-xs font-semibold text-muted-foreground mb-1">
                                  Description:
                                </div>
                                <p className="text-xs text-foreground">
                                  {subTask.description}
                                </p>
                              </div>
                              
                              {/* Result summary if completed */}
                              {subTask.result_summary && (
                                <div>
                                  <div className="text-xs font-semibold text-muted-foreground mb-1">
                                    Result:
                                  </div>
                                  <p className="text-xs text-foreground">
                                    {subTask.result_summary}
                                  </p>
                                </div>
                              )}
                              
                              {/* Session link */}
                              {subTask.session_id && (
                                <div>
                                  <div className="text-xs font-semibold text-muted-foreground mb-1">
                                    Session ID:
                                  </div>
                                  <code className="text-xs text-cyan-400 font-mono">
                                    {subTask.session_id.slice(0, 8)}...
                                  </code>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

