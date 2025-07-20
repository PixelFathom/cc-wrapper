'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Cross2Icon, CheckCircledIcon, CrossCircledIcon,
  CodeIcon, FileTextIcon, GlobeIcon, GearIcon, ChevronDownIcon,
  UpdateIcon, InfoCircledIcon, ClockIcon
} from '@radix-ui/react-icons'
import { Button } from './ui/button'
import { Textarea } from './ui/textarea'
import { api } from '@/lib/api'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/utils'

interface MCPApprovalModalProps {
  approval: any
  onClose: () => void
}

export function MCPApprovalModal({ approval, onClose }: MCPApprovalModalProps) {
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

  const getUrgencyLevel = () => {
    if (['Bash', 'Write', 'Edit', 'Delete'].includes(approval.tool_name)) return 'high'
    if (['WebFetch', 'WebSearch'].includes(approval.tool_name)) return 'medium'
    return 'low'
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

  const urgency = getUrgencyLevel()

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
          className="w-full max-w-lg bg-gray-900 rounded-xl shadow-xl overflow-hidden border border-gray-700"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-700">
            <div className="flex items-center gap-3">
              <div className={cn(
                "p-2 rounded-lg border",
                urgency === 'high' && "bg-red-900/50 text-red-400 border-red-800",
                urgency === 'medium' && "bg-amber-900/50 text-amber-400 border-amber-800",
                urgency === 'low' && "bg-gray-700 text-gray-300 border-gray-600"
              )}>
                {getToolIcon()}
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">
                  {approval.tool_name}
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  {urgency === 'high' && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-900/50 text-red-400 border border-red-800">
                      urgent
                    </span>
                  )}
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-900/50 text-purple-400 border border-purple-800">
                    MCP Tool
                  </span>
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

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Description */}
            <div>
              <p className="text-gray-200 leading-relaxed">
                {approval.display_text || approval.prompt || 'This MCP tool requires your approval to proceed.'}
              </p>
            </div>

            {/* Working Directory */}
            {approval.cwd && (
              <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                <div className="text-xs font-medium text-gray-400 mb-1">Working Directory</div>
                <code className="text-sm text-gray-200 font-mono">{approval.cwd}</code>
              </div>
            )}

            {/* Details Toggle */}
            {(approval.tool_input || (approval.details && Object.keys(approval.details).length > 0)) && (
              <div>
                <button
                  onClick={() => setShowDetails(!showDetails)}
                  className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
                >
                  <InfoCircledIcon className="h-4 w-4" />
                  <span>View details</span>
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
                      className="overflow-hidden mt-3"
                    >
                      <div className="bg-gray-800 rounded-lg p-3 space-y-3 border border-gray-700">
                        {/* Tool Input */}
                        {approval.tool_input && (
                          <div>
                            <div className="text-xs font-medium text-gray-400 mb-2">Request Parameters</div>
                            <pre className="text-xs text-gray-200 overflow-x-auto font-mono bg-gray-900 p-2 rounded border border-gray-700">
                              {JSON.stringify(approval.tool_input, null, 2)}
                            </pre>
                          </div>
                        )}

                        {/* Additional Details */}
                        {approval.details && Object.keys(approval.details).length > 0 && (
                          <div>
                            <div className="text-xs font-medium text-gray-400 mb-2">Additional Context</div>
                            <div className="space-y-1">
                              {Object.entries(approval.details).map(([key, value]) => (
                                <div key={key} className="flex gap-2 text-sm">
                                  <span className="font-medium text-gray-400 min-w-0">{key}:</span>
                                  <span className="text-gray-200 break-all">
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

          {/* Actions */}
          <div className="flex flex-col-reverse sm:flex-row gap-3 p-6 bg-gray-800 border-t border-gray-700">
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

          {/* Keyboard hint */}
          <div className="px-6 pb-4">
            <div className="text-xs text-gray-500 text-center">
              Press ⌘+Enter to approve, or Esc to close
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}