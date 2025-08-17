'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog'
import { Button } from './ui/button'
import { MarkdownRenderer } from './markdown-renderer'
import { TestCaseHooks } from './test-case-hooks'
import { 
  PlayIcon, 
  CheckCircledIcon, 
  CrossCircledIcon, 
  UpdateIcon,
  ClockIcon,
  ReaderIcon,
  ExitFullScreenIcon,
  EnterFullScreenIcon,
  CopyIcon,
  CheckIcon
} from '@radix-ui/react-icons'
import { motion } from 'framer-motion'

interface ExecutionResultModalProps {
  testCase: {
    id: string
    title: string
    status: 'pending' | 'running' | 'passed' | 'failed'
    execution_result?: string
    last_execution_at?: string
  }
  trigger: React.ReactNode
}

export function ExecutionResultModal({ testCase, trigger }: ExecutionResultModalProps) {
  const [open, setOpen] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [copied, setCopied] = useState(false)

  const copyToClipboard = async () => {
    if (!testCase.execution_result) return
    
    try {
      await navigator.clipboard.writeText(testCase.execution_result)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy result:', err)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'passed':
        return <CheckCircledIcon className="h-5 w-5 text-green-400" />
      case 'failed':
        return <CrossCircledIcon className="h-5 w-5 text-red-400" />
      case 'running':
        return <UpdateIcon className="h-5 w-5 text-yellow-400 animate-spin" />
      case 'pending':
      default:
        return <ClockIcon className="h-5 w-5 text-gray-400" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'passed':
        return 'from-green-500/30 to-emerald-500/30 border-green-400/40 text-green-300'
      case 'failed':
        return 'from-red-500/30 to-rose-500/30 border-red-400/40 text-red-300'
      case 'running':
        return 'from-yellow-500/30 to-orange-500/30 border-yellow-400/40 text-yellow-300'
      case 'pending':
      default:
        return 'from-gray-500/30 to-slate-500/30 border-gray-400/40 text-gray-300'
    }
  }

  // Only show if there's a result OR if the test case is running (to show live progress)
  if (!testCase.execution_result && testCase.status !== 'running') {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className={`${
        isFullscreen 
          ? 'w-screen h-screen max-w-none max-h-none m-0 rounded-none' 
          : 'w-[96vw] max-w-5xl max-h-[96vh] sm:max-h-[92vh]'
      } overflow-hidden transition-all duration-300 flex flex-col`}>
        
        {/* Header */}
        <DialogHeader className="flex-shrink-0 space-y-4 pb-4 border-b border-border/30">
          {/* Title Row */}
          <div className="flex items-start justify-between gap-4">
            <DialogTitle className="flex items-center gap-3 text-lg sm:text-xl font-semibold">
              <div className="bg-gradient-to-r from-cyan-500/20 to-purple-500/20 p-2 rounded-lg border border-cyan-500/30">
                <ReaderIcon className="h-5 w-5 text-cyan-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent truncate">
                    {testCase.status === 'running' ? 'Test Execution' : 'Test Result'}
                  </span>
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-gradient-to-r ${getStatusColor(testCase.status)} border shadow-sm`}>
                    {getStatusIcon(testCase.status)}
                    <span className="ml-1.5 hidden sm:inline">
                      {testCase.status.charAt(0).toUpperCase() + testCase.status.slice(1)}
                    </span>
                  </span>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2">{testCase.title}</p>
              </div>
            </DialogTitle>
            
            {/* Action Buttons */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {testCase.execution_result && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={copyToClipboard}
                  className="h-9 w-9 p-0 hover:bg-white/10"
                  title="Copy result"
                >
                  {copied ? (
                    <CheckIcon className="h-4 w-4 text-green-400" />
                  ) : (
                    <CopyIcon className="h-4 w-4" />
                  )}
                </Button>
              )}
              
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="h-9 w-9 p-0 hover:bg-white/10"
                title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              >
                {isFullscreen ? (
                  <ExitFullScreenIcon className="h-4 w-4" />
                ) : (
                  <EnterFullScreenIcon className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Metadata */}
          {testCase.last_execution_at && (
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <PlayIcon className="h-3 w-3" />
                <span>Last executed {new Date(testCase.last_execution_at).toLocaleString()}</span>
              </div>
              {testCase.execution_result && (
                <div className="flex items-center gap-1.5">
                  <ReaderIcon className="h-3 w-3" />
                  <span>{testCase.execution_result.length} characters</span>
                </div>
              )}
            </div>
          )}
        </DialogHeader>

        {/* Content */}
        <motion.div 
          className={`flex-1 overflow-y-auto p-1 -mx-1 space-y-4 ${
            isFullscreen ? 'max-h-none' : 'max-h-[60vh]'
          }`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          {/* Execution Steps (Hooks) - Always show, let component decide visibility */}
          <div className={`bg-gradient-to-br from-blue-500/5 to-purple-500/5 rounded-lg border border-blue-500/20 ${
            isFullscreen ? 'p-6' : 'p-4 sm:p-6'
          }`}>
            <TestCaseHooks 
              testCaseId={testCase.id}
              isProcessing={testCase.status === 'running'}
              showByDefault={testCase.status === 'running'}
            />
          </div>

          {/* Execution Result */}
          <div className={`bg-gradient-to-br from-card/60 to-card/80 rounded-lg border border-border/30 ${
            isFullscreen ? 'p-6' : 'p-4 sm:p-6'
          }`}>
            {testCase.execution_result ? (
              <MarkdownRenderer 
                content={testCase.execution_result}
                className="min-h-[200px]"
                compact={!isFullscreen}
              />
            ) : (
              <div className="text-center py-12">
                <div className="bg-muted/20 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                  <ReaderIcon className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium text-muted-foreground mb-2">No Result Available</h3>
                <p className="text-sm text-muted-foreground/80">
                  {testCase.status === 'running' ? 
                    'Test case is currently being executed. Results will appear here when complete.' :
                    'This test case hasn\'t been executed yet or the execution didn\'t produce a result.'
                  }
                </p>
              </div>
            )}
          </div>
        </motion.div>

        {/* Mobile-friendly footer for non-fullscreen mode */}
        {!isFullscreen && (
          <motion.div 
            className="flex-shrink-0 pt-4 border-t border-border/30 sm:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex justify-center">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setOpen(false)}
                className="px-6"
              >
                Close
              </Button>
            </div>
          </motion.div>
        )}
      </DialogContent>
    </Dialog>
  )
}