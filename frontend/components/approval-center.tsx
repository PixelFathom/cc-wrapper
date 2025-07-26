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
    refetchInterval: 5000, // Poll every 5 seconds for better performance
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
                "bottom-20 right-6 w-96 max-w-[calc(100vw-2rem)]",
                "max-h-[80vh] overflow-hidden flex flex-col"
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

              {/* Content - Improved scrolling */}
              <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
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
                  <div className="divide-y divide-gray-700">
                    {approvals.map((approval: ApprovalItem, index: number) => (
                      <motion.button
                        key={approval.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        onClick={() => {
                          setSelectedApproval(approval)
                          setIsOpen(false)
                        }}
                        className="w-full text-left p-4 hover:bg-gray-800/50 transition-colors group relative overflow-hidden"
                      >
                        {/* Urgency indicator */}
                        <div className={cn(
                          "absolute left-0 top-0 bottom-0 w-1",
                          approval.urgency === 'high' && "bg-red-500",
                          approval.urgency === 'medium' && "bg-amber-500",
                          approval.urgency === 'low' && "bg-gray-500"
                        )} />
                        
                        <div className="flex items-start gap-3 pl-2">
                          {/* Icon */}
                          <div className={cn(
                            "p-2 rounded-lg shrink-0 border",
                            approval.urgency === 'high' && "bg-red-900/30 text-red-400 border-red-800/50",
                            approval.urgency === 'medium' && "bg-amber-900/30 text-amber-400 border-amber-800/50",
                            approval.urgency === 'low' && "bg-gray-700/50 text-gray-300 border-gray-600/50"
                          )}>
                            {getToolIcon(approval)}
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="font-semibold text-white text-sm font-mono">
                                {approval.type === 'mcp' 
                                  ? approval.tool_name 
                                  : approval.action_type || 'Action'}
                              </span>
                              {approval.urgency === 'high' && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-900/50 text-red-300 border border-red-800/50">
                                  urgent
                                </span>
                              )}
                            </div>
                            
                            <p className="text-sm text-gray-300 line-clamp-2 mb-3 leading-relaxed">
                              {approval.display_text || approval.prompt || 'Approval needed'}
                            </p>

                            <div className="flex items-center justify-between text-xs">
                              {approval.cwd && (
                                <span className="font-mono text-gray-400 bg-gray-800 px-2 py-1 rounded truncate max-w-[200px]">
                                  {approval.cwd}
                                </span>
                              )}
                              <span className="ml-auto text-gray-500 flex items-center gap-1">
                                <ClockIcon className="h-3 w-3" />
                                {formatTimeAgo(approval.created_at)}
                              </span>
                            </div>
                          </div>

                          <ChevronRightIcon className="h-4 w-4 text-gray-500 group-hover:text-gray-300 transition-colors shrink-0 mt-1" />
                        </div>
                      </motion.button>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer - Enhanced */}
              {pendingCount > 0 && (
                <div className="px-4 py-3 bg-gray-800/95 backdrop-blur-sm border-t border-gray-700 flex-shrink-0">
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <div className="flex items-center gap-1">
                      <kbd className="px-1.5 py-0.5 bg-gray-700 rounded text-xs">⌘</kbd>
                      <kbd className="px-1.5 py-0.5 bg-gray-700 rounded text-xs">A</kbd>
                      <span>to open</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <kbd className="px-1.5 py-0.5 bg-gray-700 rounded text-xs">ESC</kbd>
                      <span>to close</span>
                    </div>
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