'use client'

import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  LockClosedIcon, Cross2Icon, ExclamationTriangleIcon,
  CodeIcon, FileTextIcon, GlobeIcon, GearIcon, ClockIcon,
  CheckCircledIcon, ChevronRightIcon, UpdateIcon
} from '@radix-ui/react-icons'
import { api } from '@/lib/api'
import { Button } from './ui/button'
import { cn } from '@/lib/utils'
import { ApprovalDetailModal } from './approval-detail-modal'

interface ApprovalItem {
  id: string
  type: 'mcp' | 'regular'
  tool_name?: string
  action_type?: string
  display_text?: string
  prompt?: string
  details?: any
  cwd?: string
  created_at: string
  urgency: 'high' | 'medium' | 'low'
}

export function ApprovalCenter() {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedApproval, setSelectedApproval] = useState<ApprovalItem | null>(null)
  const queryClient = useQueryClient()

  // Poll for pending approvals
  const { data: approvals = [], isLoading } = useQuery({
    queryKey: ['approval-center'],
    queryFn: async () => {
      try {
        const data = await api.getPendingApprovals()
        return data.map((approval: any) => ({
          ...approval,
          urgency: getUrgencyLevel(approval)
        }))
      } catch (error) {
        console.error('Failed to fetch approvals:', error)
        return []
      }
    },
    refetchInterval: 2000,
    staleTime: 0,
  })

  const pendingCount = approvals.length
  const hasUrgent = approvals.some((a: ApprovalItem) => a.urgency === 'high')

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false)
      }
      if (e.key === 'a' && e.metaKey && pendingCount > 0) {
        e.preventDefault()
        setIsOpen(true)
      }
    }
    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [isOpen, pendingCount])

  const getUrgencyLevel = (approval: any): 'high' | 'medium' | 'low' => {
    if (approval.type === 'mcp') {
      if (['Bash', 'Write', 'Edit', 'Delete'].includes(approval.tool_name)) return 'high'
      if (['WebFetch', 'WebSearch'].includes(approval.tool_name)) return 'medium'
      return 'low'
    }
    return approval.action_type === 'command' ? 'high' : 'medium'
  }

  const getToolIcon = (approval: ApprovalItem) => {
    if (approval.type === 'mcp') {
      switch (approval.tool_name) {
        case 'Bash': return <CodeIcon className="h-4 w-4" />
        case 'Read':
        case 'Write':
        case 'Edit': return <FileTextIcon className="h-4 w-4" />
        case 'WebFetch':
        case 'WebSearch': return <GlobeIcon className="h-4 w-4" />
        default: return <GearIcon className="h-4 w-4" />
      }
    }
    return approval.action_type === 'command' 
      ? <CodeIcon className="h-4 w-4" /> 
      : <FileTextIcon className="h-4 w-4" />
  }

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date().getTime()
    const time = new Date(timestamp).getTime()
    const diff = Math.floor((now - time) / 1000)
    
    if (diff < 60) return 'now'
    if (diff < 3600) return `${Math.floor(diff / 60)}m`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`
    return `${Math.floor(diff / 86400)}d`
  }

  return (
    <>
      {/* Floating Action Button - Dark Design */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "fixed bottom-6 right-6 z-50 rounded-full shadow-lg",
          "w-12 h-12 flex items-center justify-center",
          "bg-gray-800 border border-gray-700 hover:border-gray-600",
          "transition-all duration-200",
          hasUrgent ? "bg-red-900/50 border-red-700 hover:border-red-600" : "",
          pendingCount > 0 ? "bg-amber-900/50 border-amber-700 hover:border-amber-600" : ""
        )}
      >
        <LockClosedIcon className={cn(
          "h-5 w-5",
          hasUrgent ? "text-red-400" : pendingCount > 0 ? "text-amber-400" : "text-gray-400"
        )} />
        
        {/* Badge */}
        {pendingCount > 0 && (
          <span className={cn(
            "absolute -top-1 -right-1 rounded-full text-xs font-semibold",
            "min-w-[18px] h-[18px] flex items-center justify-center",
            "text-white",
            hasUrgent ? "bg-red-500" : "bg-amber-500"
          )}>
            {pendingCount > 9 ? '9+' : pendingCount}
          </span>
        )}
      </motion.button>

      {/* Approval Panel - Mobile First */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-40"
              onClick={() => setIsOpen(false)}
            />

            {/* Panel */}
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ type: 'spring', damping: 20, stiffness: 300 }}
              className={cn(
                "fixed z-50 bg-gray-900 rounded-lg shadow-xl border border-gray-700",
                "bottom-20 right-6 w-80 max-w-[calc(100vw-3rem)]",
                "max-h-[70vh] overflow-hidden"
              )}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-700">
                <div>
                  <h3 className="font-semibold text-white">Approvals</h3>
                  {pendingCount > 0 && (
                    <p className="text-sm text-gray-400">
                      {pendingCount} pending
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsOpen(false)}
                  className="h-8 w-8 p-0 hover:bg-gray-800 text-gray-400 hover:text-white"
                >
                  <Cross2Icon className="h-4 w-4" />
                </Button>
              </div>

              {/* Content */}
              <div className="max-h-[50vh] overflow-y-auto">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <UpdateIcon className="h-5 w-5 animate-spin text-gray-400" />
                  </div>
                ) : pendingCount === 0 ? (
                  <div className="text-center py-8 px-4">
                    <CheckCircledIcon className="h-8 w-8 text-green-400 mx-auto mb-2" />
                    <p className="text-sm font-medium text-white">All clear!</p>
                    <p className="text-xs text-gray-400">No pending approvals</p>
                  </div>
                ) : (
                  <div className="p-2">
                    {approvals.map((approval: ApprovalItem) => (
                      <button
                        key={approval.id}
                        onClick={() => {
                          setSelectedApproval(approval)
                          setIsOpen(false)
                        }}
                        className="w-full text-left p-3 rounded-lg hover:bg-gray-800 transition-colors group"
                      >
                        <div className="flex items-start gap-3">
                          {/* Icon */}
                          <div className={cn(
                            "p-2 rounded-md shrink-0",
                            approval.urgency === 'high' && "bg-red-900/50 text-red-400 border border-red-800",
                            approval.urgency === 'medium' && "bg-amber-900/50 text-amber-400 border border-amber-800",
                            approval.urgency === 'low' && "bg-gray-700 text-gray-300 border border-gray-600"
                          )}>
                            {getToolIcon(approval)}
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-white text-sm">
                                {approval.type === 'mcp' 
                                  ? approval.tool_name 
                                  : approval.action_type || 'Action'}
                              </span>
                              {approval.urgency === 'high' && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-900/50 text-red-400 border border-red-800">
                                  urgent
                                </span>
                              )}
                            </div>
                            
                            <p className="text-sm text-gray-300 line-clamp-2 mb-1">
                              {approval.display_text || approval.prompt || 'Approval needed'}
                            </p>

                            <div className="flex items-center justify-between text-xs text-gray-500">
                              {approval.cwd && (
                                <span className="font-mono truncate max-w-[180px]">
                                  {approval.cwd}
                                </span>
                              )}
                              <span className="ml-auto">
                                {formatTimeAgo(approval.created_at)}
                              </span>
                            </div>
                          </div>

                          <ChevronRightIcon className="h-4 w-4 text-gray-500 group-hover:text-gray-400 transition-colors shrink-0" />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              {pendingCount > 0 && (
                <div className="px-4 py-3 bg-gray-800 border-t border-gray-700">
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>⌘A to open</span>
                    <span>ESC to close</span>
                  </div>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Approval Detail Modal */}
      {selectedApproval && (
        <ApprovalDetailModal
          approval={selectedApproval}
          onClose={() => {
            setSelectedApproval(null)
            queryClient.invalidateQueries({ queryKey: ['approval-center'] })
          }}
        />
      )}
    </>
  )
}