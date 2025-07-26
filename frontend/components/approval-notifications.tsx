'use client'

import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  BellIcon, Cross2Icon, ExclamationTriangleIcon, CheckCircledIcon,
  CodeIcon, FileTextIcon, GlobeIcon, GearIcon, ClockIcon,
  RocketIcon, LockClosedIcon
} from '@radix-ui/react-icons'
import { api } from '@/lib/api'
import { Button } from './ui/button'
import { ApprovalModal } from './approval-modal'
import { MCPApprovalModal } from './mcp-approval-modal'
import { cn } from '@/lib/utils'

export function ApprovalNotifications() {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedApproval, setSelectedApproval] = useState<any>(null)
  const queryClient = useQueryClient()

  // Poll for pending approvals across all projects every 2 seconds
  const { data: allApprovals = [] } = useQuery({
    queryKey: ['global-approvals'],
    queryFn: async () => {
      try {
        // Fetch all pending approvals (no filters)
        return await api.getPendingApprovals()
      } catch (error) {
        console.error('Failed to fetch approvals:', error)
        return []
      }
    },
    refetchInterval: 3000, // Poll every 3 seconds for better performance
  })

  const approvalCount = allApprovals.length

  // Play a sound when new approvals come in
  useEffect(() => {
    if (approvalCount > 0 && !isOpen) {
      // Optional: Play notification sound
      // new Audio('/notification.mp3').play().catch(() => {})
    }
  }, [approvalCount])

  const handleApprovalComplete = () => {
    // Refresh approvals after action
    queryClient.invalidateQueries({ queryKey: ['global-approvals'] })
    setSelectedApproval(null)
  }

  // Helper function to get icon for approval type
  const getApprovalIcon = (approval: any) => {
    if (approval.type === 'mcp') {
      switch (approval.tool_name) {
        case 'Bash': return <CodeIcon className="h-4 w-4" />
        case 'Read':
        case 'Write':
        case 'Edit': return <FileTextIcon className="h-4 w-4" />
        case 'WebFetch': return <GlobeIcon className="h-4 w-4" />
        default: return <GearIcon className="h-4 w-4" />
      }
    }
    return <ExclamationTriangleIcon className="h-4 w-4" />
  }

  // Helper to get urgency level
  const getUrgencyLevel = (approval: any) => {
    if (approval.type === 'mcp') {
      if (['Bash', 'Write', 'Edit', 'Delete'].includes(approval.tool_name)) return 'high'
      if (['WebFetch', 'WebSearch'].includes(approval.tool_name)) return 'medium'
      return 'low'
    }
    return approval.action_type === 'command' ? 'high' : 'medium'
  }

  return (
    <>
      {/* Floating action button - dark design */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "fixed bottom-6 right-6 z-50 rounded-full shadow-lg",
          "w-12 h-12 flex items-center justify-center",
          "bg-gray-800 border border-gray-700 hover:border-gray-600",
          "transition-all duration-200",
          approvalCount > 0 && getUrgencyLevel(allApprovals[0]) === 'high' ? "bg-red-900/50 border-red-700 hover:border-red-600" : "",
          approvalCount > 0 && getUrgencyLevel(allApprovals[0]) !== 'high' ? "bg-amber-900/50 border-amber-700 hover:border-amber-600" : ""
        )}
      >
        {approvalCount > 0 ? (
          <LockClosedIcon className={cn(
            "h-5 w-5",
            getUrgencyLevel(allApprovals[0]) === 'high' ? "text-red-400" : "text-amber-400"
          )} />
        ) : (
          <BellIcon className="h-5 w-5 text-gray-400" />
        )}
        
        {/* Badge */}
        {approvalCount > 0 && (
          <span className={cn(
            "absolute -top-1 -right-1 rounded-full text-xs font-semibold",
            "min-w-[18px] h-[18px] flex items-center justify-center",
            "text-white",
            getUrgencyLevel(allApprovals[0]) === 'high' ? "bg-red-500" : "bg-amber-500"
          )}>
            {approvalCount > 9 ? '9+' : approvalCount}
          </span>
        )}
      </motion.button>

      {/* Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <>
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
                  {approvalCount > 0 && (
                    <p className="text-sm text-gray-400">
                      {approvalCount} pending
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
                {approvalCount === 0 ? (
                  <div className="text-center py-8 px-4">
                    <CheckCircledIcon className="h-8 w-8 text-green-400 mx-auto mb-2" />
                    <p className="text-sm font-medium text-white">All clear!</p>
                    <p className="text-xs text-gray-400">No pending approvals</p>
                  </div>
                ) : (
                  <div className="p-2">
                    {allApprovals.map((approval) => (
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
                            getUrgencyLevel(approval) === 'high' && "bg-red-900/50 text-red-400 border border-red-800",
                            getUrgencyLevel(approval) === 'medium' && "bg-amber-900/50 text-amber-400 border border-amber-800",
                            getUrgencyLevel(approval) === 'low' && "bg-gray-700 text-gray-300 border border-gray-600"
                          )}>
                            {getApprovalIcon(approval)}
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-white text-sm">
                                {approval.type === 'mcp' 
                                  ? approval.tool_name 
                                  : approval.action_type || 'Action'}
                              </span>
                              {getUrgencyLevel(approval) === 'high' && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-900/50 text-red-400 border border-red-800">
                                  urgent
                                </span>
                              )}
                              {approval.type === 'mcp' && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-purple-900/50 text-purple-400 border border-purple-800">
                                  MCP
                                </span>
                              )}
                            </div>
                            
                            <p className="text-sm text-gray-300 line-clamp-2 mb-1">
                              {approval.type === 'mcp' 
                                ? approval.display_text 
                                : (typeof approval.details === 'object' && approval.details?.reason || 'Approval needed')}
                            </p>

                            <div className="flex items-center justify-between text-xs text-gray-500">
                              {approval.cwd && (
                                <span className="font-mono truncate max-w-[180px]">
                                  {approval.cwd}
                                </span>
                              )}
                              <span className="ml-auto">
                                now
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
              {approvalCount > 0 && (
                <div className="px-4 py-3 bg-gray-800 border-t border-gray-700">
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>Live updates every 3s</span>
                    <span>ESC to close</span>
                  </div>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Approval modal */}
      {selectedApproval && (
        selectedApproval.type === 'mcp' ? (
          <MCPApprovalModal
            approval={selectedApproval}
            onClose={() => {
              handleApprovalComplete()
            }}
          />
        ) : (
          <ApprovalModal
            approval={selectedApproval}
            onClose={() => {
              handleApprovalComplete()
            }}
          />
        )
      )}
    </>
  )
}