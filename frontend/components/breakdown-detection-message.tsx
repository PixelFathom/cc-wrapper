'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  RocketIcon,
  UpdateIcon,
  CheckCircledIcon,
  LightningBoltIcon
} from '@radix-ui/react-icons'
import { cn } from '@/lib/utils'
import { BreakdownAnalysis } from '@/lib/api/task-breakdown'

interface BreakdownDetectionMessageProps {
  breakdownInfo: BreakdownAnalysis
  onStartExecution?: () => void
  autoStartDelay?: number // milliseconds before auto-starting
}

export function BreakdownDetectionMessage({
  breakdownInfo,
  onStartExecution,
  autoStartDelay = 3000
}: BreakdownDetectionMessageProps) {
  const [countdown, setCountdown] = useState(Math.ceil(autoStartDelay / 1000))
  const [hasStarted, setHasStarted] = useState(false)
  
  useEffect(() => {
    if (hasStarted || !onStartExecution) return
    
    // Countdown timer
    const countdownInterval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownInterval)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    
    // Auto-start timer
    const autoStartTimer = setTimeout(() => {
      setHasStarted(true)
      onStartExecution()
    }, autoStartDelay)
    
    return () => {
      clearInterval(countdownInterval)
      clearTimeout(autoStartTimer)
    }
  }, [hasStarted, onStartExecution, autoStartDelay])
  
  const handleManualStart = () => {
    if (!hasStarted && onStartExecution) {
      setHasStarted(true)
      setCountdown(0)
      onStartExecution()
    }
  }
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="w-full max-w-3xl mx-auto"
    >
      <div className="bg-gradient-to-br from-purple-500/10 via-cyan-500/10 to-blue-500/10 backdrop-blur-sm rounded-lg border-2 border-purple-500/30 p-6 shadow-xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <motion.div
            animate={{
              scale: [1, 1.2, 1],
              rotate: [0, 10, -10, 0]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              repeatDelay: 1
            }}
            className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center"
          >
            <LightningBoltIcon className="h-6 w-6 text-white" />
          </motion.div>
          
          <div className="flex-1">
            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
              🎯 Task Breakdown Detected
              {hasStarted && (
                <motion.span
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-sm font-normal text-green-500"
                >
                  <CheckCircledIcon className="inline h-4 w-4 mr-1" />
                  Started
                </motion.span>
              )}
            </h3>
            <p className="text-sm text-muted-foreground">
              Your request will be broken down into {breakdownInfo.total_sub_tasks} sequential tasks
            </p>
          </div>
        </div>
        
        {/* Reasoning */}
        <div className="mb-4 p-3 bg-muted/50 rounded-md border border-border/50">
          <div className="text-xs font-semibold text-muted-foreground mb-1">
            Analysis:
          </div>
          <p className="text-sm text-foreground">
            {breakdownInfo.reasoning}
          </p>
        </div>
        
        {/* Sub-tasks list */}
        <div className="space-y-2 mb-4">
          <div className="text-xs font-semibold text-muted-foreground mb-2">
            Planned Tasks:
          </div>
          {breakdownInfo.sub_tasks.map((task, index) => (
            <motion.div
              key={task.sequence}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="flex items-start gap-3 p-3 bg-card/50 rounded-md border border-border/30 hover:border-cyan-500/30 transition-colors"
            >
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center">
                <span className="text-xs font-bold text-cyan-400">
                  {task.sequence}
                </span>
              </div>
              
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-foreground mb-1">
                  {task.title}
                </h4>
                <p className="text-xs text-muted-foreground">
                  {task.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
        
        {/* Action section */}
        {!hasStarted ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center justify-between p-4 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 rounded-md border border-cyan-500/30"
          >
            <div className="flex items-center gap-2">
              <UpdateIcon className="h-4 w-4 text-cyan-400 animate-spin" />
              <span className="text-sm font-medium text-foreground">
                Auto-starting in {countdown} second{countdown !== 1 ? 's' : ''}...
              </span>
            </div>
            
            <button
              onClick={handleManualStart}
              className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-sm font-medium rounded-md hover:shadow-lg transition-all duration-200"
            >
              Start Now
            </button>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 p-4 bg-green-500/10 rounded-md border border-green-500/30"
          >
            <CheckCircledIcon className="h-5 w-5 text-green-500" />
            <span className="text-sm font-medium text-green-500">
              Execution started! Tasks will be processed automatically.
            </span>
          </motion.div>
        )}
        
        {/* Info footer */}
        <div className="mt-4 pt-4 border-t border-border/30">
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <RocketIcon className="h-3 w-3 mt-0.5 flex-shrink-0" />
            <p>
              Each task will be executed sequentially and tested automatically. 
              You can monitor the progress in real-time below.
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

