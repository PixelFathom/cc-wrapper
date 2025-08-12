'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Cross2Icon, CheckCircledIcon, CrossCircledIcon,
  CodeIcon, FileTextIcon, GlobeIcon, GearIcon, ChevronDownIcon,
  UpdateIcon, InfoCircledIcon, ClockIcon
} from '@radix-ui/react-icons'
import { Button } from './ui/button'
import { Textarea } from './ui/textarea'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

interface ApprovalDetailModalProps {
  approval: any
  onClose: () => void
}

export function ApprovalDetailModal({ approval, onClose }: ApprovalDetailModalProps) {
  const [comment, setComment] = useState('')
  const [showDetails, setShowDetails] = useState(false)
  const [decision, setDecision] = useState<'approved' | 'rejected' | null>(null)
  const queryClient = useQueryClient()

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Enter' && e.metaKey) {
        e.preventDefault()
        handleDecision('approved')
      }
    }
    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [])

  const submitMutation = useMutation({
    mutationFn: api.submitApprovalResult,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approval-center'] })
      queryClient.invalidateQueries({ queryKey: ['global-approvals'] })
      setTimeout(onClose, 300)
    },
  })

  const handleDecision = (selectedDecision: 'approved' | 'rejected') => {
    if (decision) return
    
    setDecision(selectedDecision)
    submitMutation.mutate({
      approval_id: approval.id,
      decision: selectedDecision,
      comment: comment || undefined,
    })
  }

  const getToolIcon = () => {
    if (approval.type === 'mcp') {
      switch (approval.tool_name) {
        case 'Bash': return <CodeIcon className="h-5 w-5" />
        case 'Read':
        case 'Write':
        case 'Edit': return <FileTextIcon className="h-5 w-5" />
        case 'WebFetch':
        case 'WebSearch': return <GlobeIcon className="h-5 w-5" />
        default: return <GearIcon className="h-5 w-5" />
      }
    }
    return approval.action_type === 'command' 
      ? <CodeIcon className="h-5 w-5" /> 
      : <FileTextIcon className="h-5 w-5" />
  }

  const getUrgencyColor = () => {
    switch (approval.urgency) {
      case 'high': return 'bg-red-100 text-red-700 border-red-200'
      case 'medium': return 'bg-amber-100 text-amber-700 border-amber-200'
      case 'low': return 'bg-gray-100 text-gray-700 border-gray-200'
      default: return 'bg-gray-100 text-gray-700 border-gray-200'
    }
  }

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date().getTime()
    const time = new Date(timestamp).getTime()
    const diff = Math.floor((now - time) / 1000)
    
    if (diff < 60) return 'now'
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return `${Math.floor(diff / 86400)}d ago`
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="w-full max-w-2xl max-h-[90vh] bg-gray-900 rounded-xl shadow-xl overflow-hidden border border-gray-700 flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-700">
            <div className="flex items-center gap-3">
              <div className={cn(
                "p-2 rounded-lg border",
                approval.urgency === 'high' && "bg-red-900/50 text-red-400 border-red-800",
                approval.urgency === 'medium' && "bg-amber-900/50 text-amber-400 border-amber-800",
                approval.urgency === 'low' && "bg-gray-700 text-gray-300 border-gray-600"
              )}>
                {getToolIcon()}
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">
                  {approval.type === 'mcp' 
                    ? approval.tool_name 
                    : approval.action_type || 'Approval Required'}
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  {approval.urgency === 'high' && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-900/50 text-red-400 border border-red-800">
                      urgent
                    </span>
                  )}
                  <span className="text-sm text-gray-400 flex items-center gap-1">
                    <ClockIcon className="h-3 w-3" />
                    {formatTimeAgo(approval.created_at)}
                  </span>
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0 text-gray-400 hover:text-white hover:bg-gray-800"
            >
              <Cross2Icon className="h-4 w-4" />
            </Button>
          </div>

          {/* Content - Scrollable */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Description */}
            <div>
              <p className="text-gray-200 leading-relaxed">
                {approval.display_text || approval.prompt || 'This action requires your approval to proceed.'}
              </p>
            </div>

            {/* Working Directory */}
            {approval.cwd && (
              <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                <div className="text-xs font-medium text-gray-400 mb-1">Working Directory</div>
                <code className="text-sm text-gray-200 font-mono">{approval.cwd}</code>
              </div>
            )}

            {/* Details Toggle - Always expanded for better developer experience */}
            {(approval.tool_input || (approval.details && Object.keys(approval.details).length > 0)) && (
              <div>
                <button
                  onClick={() => setShowDetails(!showDetails)}
                  className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200 transition-colors mb-3"
                >
                  <InfoCircledIcon className="h-4 w-4" />
                  <span>Technical Details</span>
                  <ChevronDownIcon className={cn(
                    "h-4 w-4 transition-transform",
                    showDetails && "rotate-180"
                  )} />
                </button>
                
                <AnimatePresence>
                  {showDetails && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="bg-gray-800/50 rounded-lg border border-gray-700 overflow-hidden">
                        {/* Tool Input */}
                        {approval.tool_input && (
                          <div className="border-b border-gray-700 last:border-b-0">
                            <div className="bg-gray-800 px-3 py-2 border-b border-gray-700">
                              <div className="text-xs font-medium text-gray-300 flex items-center gap-2">
                                <CodeIcon className="h-3 w-3" />
                                Request Parameters
                              </div>
                            </div>
                            <div className="p-3">
                              <pre className="text-xs text-gray-200 overflow-x-auto font-mono bg-gray-900/50 p-3 rounded border border-gray-700 max-h-48 overflow-y-auto">
                                <code className="text-cyan-400">{JSON.stringify(approval.tool_input, null, 2)}</code>
                              </pre>
                            </div>
                          </div>
                        )}

                        {/* Additional Details */}
                        {approval.details && Object.keys(approval.details).length > 0 && (
                          <div>
                            <div className="bg-gray-800 px-3 py-2 border-b border-gray-700">
                              <div className="text-xs font-medium text-gray-300 flex items-center gap-2">
                                <InfoCircledIcon className="h-3 w-3" />
                                Additional Context
                              </div>
                            </div>
                            <div className="p-3 space-y-2 max-h-32 overflow-y-auto">
                              {Object.entries(approval.details).map(([key, value]) => (
                                <div key={key} className="flex gap-3 text-sm py-1">
                                  <span className="font-medium text-gray-400 min-w-[80px] flex-shrink-0">{key}:</span>
                                  <span className="text-gray-200 break-all font-mono text-xs">
                                    {typeof value === 'string' ? value : JSON.stringify(value)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Comment */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Add a comment (optional)
              </label>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Provide context for your decision..."
                className="w-full bg-gray-800 border-gray-700 text-gray-200 placeholder:text-gray-500 focus:border-blue-500"
                rows={3}
              />
            </div>
          </div>

          {/* Actions - Fixed at bottom */}
          <div className="flex flex-col-reverse sm:flex-row gap-3 p-6 bg-gray-800/95 backdrop-blur-sm border-t border-gray-700 flex-shrink-0">
            <Button
              variant="outline"
              onClick={() => handleDecision('rejected')}
              disabled={submitMutation.isPending}
              className={cn(
                "flex-1 sm:flex-none border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white",
                decision === 'rejected' && "bg-red-900/30 border-red-700 text-red-400"
              )}
            >
              {decision === 'rejected' && submitMutation.isPending ? (
                <>
                  <UpdateIcon className="mr-2 h-4 w-4 animate-spin" />
                  Denying...
                </>
              ) : (
                <>
                  <CrossCircledIcon className="mr-2 h-4 w-4" />
                  Deny
                </>
              )}
            </Button>
            
            <Button
              onClick={() => handleDecision('approved')}
              disabled={submitMutation.isPending}
              className={cn(
                "flex-1 sm:flex-none bg-green-600 hover:bg-green-700 text-white",
                decision === 'approved' && "animate-pulse"
              )}
            >
              {decision === 'approved' && submitMutation.isPending ? (
                <>
                  <UpdateIcon className="mr-2 h-4 w-4 animate-spin" />
                  Approving...
                </>
              ) : (
                <>
                  <CheckCircledIcon className="mr-2 h-4 w-4" />
                  Approve
                </>
              )}
            </Button>
          </div>

          {/* Keyboard hint - Fixed at bottom */}
          <div className="px-6 pb-4 bg-gray-800/95 flex-shrink-0">
            <div className="text-xs text-gray-500 text-center flex items-center justify-center gap-4">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-gray-700 rounded text-xs">⌘</kbd>
                <kbd className="px-1.5 py-0.5 bg-gray-700 rounded text-xs">Enter</kbd>
                to approve
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-gray-700 rounded text-xs">Esc</kbd>
                to close
              </span>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}