'use client'

import { useState, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Activity,
  Terminal,
  FileEdit,
  Eye,
  Sparkles,
  Search,
  Globe,
  MessageSquare,
  Loader2
} from 'lucide-react'
import { api } from '@/lib/api'
import { StageHooksSection } from './issues/stages/shared-stage-components'

interface MessageHooksProps {
  messageId: string
  isProcessing?: boolean
  showByDefault?: boolean
}

export function MessageHooks({ messageId, isProcessing = false, showByDefault = false }: MessageHooksProps) {
  const [isOpen, setIsOpen] = useState(isProcessing && showByDefault)

  // Fetch hooks for this message
  const { data: hooksData, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['message-hooks', messageId],
    queryFn: () => api.getMessageHooks(messageId),
    enabled: !!messageId,
    refetchInterval: isProcessing ? 3000 : false,
  })

  const hooks = hooksData?.hooks || []

  // Only auto-open when actively processing and showByDefault is true
  useEffect(() => {
    if (isProcessing && showByDefault) {
      setIsOpen(true)
    } else if (!isProcessing) {
      setIsOpen(false)
    }
  }, [isProcessing, showByDefault])

  // Filter out the final result message and query_initiated from thinking steps
  const thinkingHooks = useMemo(() => {
    return hooks.filter((h: any) =>
      !(h.hook_type === 'status' && h.status === 'completed' && h.content_type === 'result') &&
      !(h.message_type === 'ResultMessage' && h.content_type === 'result') &&
      h.hook_type !== 'query_initiated'
    )
  }, [hooks])

  // Transform hooks to the format expected by StageHooksSection
  const transformedHooks = useMemo(() => {
    return thinkingHooks.map((hook: any) => {
      let icon = Activity
      let iconColor = 'text-muted-foreground'
      let bgColor = 'bg-muted'
      let title = hook.message || 'Activity'
      let details: Record<string, any> = {}

      // Determine icon and styling based on hook type
      if (hook.tool_name === 'Edit' || hook.tool_name === 'Write') {
        icon = FileEdit
        iconColor = 'text-blue-600'
        bgColor = 'bg-blue-100 dark:bg-blue-900/30'
        title = `${hook.tool_name}: ${hook.tool_input?.file_path?.split('/').pop() || 'file'}`
        details = {
          filePath: hook.tool_input?.file_path,
          oldString: hook.tool_input?.old_string,
          newString: hook.tool_input?.new_string,
        }
      } else if (hook.tool_name === 'Bash') {
        icon = Terminal
        iconColor = 'text-green-600'
        bgColor = 'bg-green-100 dark:bg-green-900/30'
        title = 'Shell Command'
        details = { command: hook.tool_input?.command }
      } else if (hook.tool_name === 'Read') {
        icon = Eye
        iconColor = 'text-purple-600'
        bgColor = 'bg-purple-100 dark:bg-purple-900/30'
        title = `Read: ${hook.tool_input?.file_path?.split('/').pop() || 'file'}`
        details = { filePath: hook.tool_input?.file_path }
      } else if (hook.tool_name === 'Grep' || hook.tool_name === 'Glob') {
        icon = Search
        iconColor = 'text-orange-600'
        bgColor = 'bg-orange-100 dark:bg-orange-900/30'
        title = `${hook.tool_name}: ${hook.tool_input?.pattern || 'search'}`
        details = {
          pattern: hook.tool_input?.pattern,
          path: hook.tool_input?.path
        }
      } else if (hook.tool_name === 'WebFetch' || hook.tool_name === 'WebSearch') {
        icon = Globe
        iconColor = 'text-cyan-600'
        bgColor = 'bg-cyan-100 dark:bg-cyan-900/30'
        title = `${hook.tool_name}`
        details = {
          url: hook.tool_input?.url,
          query: hook.tool_input?.query
        }
      } else if (hook.hook_type === 'planning') {
        icon = Sparkles
        iconColor = 'text-violet-600'
        bgColor = 'bg-violet-100 dark:bg-violet-900/30'
        title = hook.step_name || hook.message || 'Planning'
        details = { result: hook.data?.result }
      } else if (hook.hook_type === 'status') {
        icon = Sparkles
        iconColor = 'text-purple-600'
        bgColor = 'bg-purple-100 dark:bg-purple-900/30'
        title = hook.message || 'Status Update'
        details = { result: hook.data?.result }
      } else if (hook.content_type === 'tool_use') {
        icon = Terminal
        iconColor = 'text-amber-600'
        bgColor = 'bg-amber-100 dark:bg-amber-900/30'
        title = hook.tool_name || 'Tool'
        details = {
          input: hook.tool_input ? JSON.stringify(hook.tool_input, null, 2) : undefined
        }
      } else if (hook.content_type === 'tool_result') {
        icon = Activity
        iconColor = 'text-emerald-600'
        bgColor = 'bg-emerald-100 dark:bg-emerald-900/30'
        title = 'Tool Result'
        details = { result: hook.data?.result || hook.message }
      } else if (hook.content_type === 'text' && hook.message_type === 'AssistantMessage') {
        icon = MessageSquare
        iconColor = 'text-blue-600'
        bgColor = 'bg-blue-100 dark:bg-blue-900/30'
        title = 'Thinking'
        details = { result: hook.data?.result || hook.message }
      } else if (hook.status === 'processing') {
        icon = Loader2
        iconColor = 'text-yellow-600'
        bgColor = 'bg-yellow-100 dark:bg-yellow-900/30'
        title = 'Processing'
        details = { message: hook.message }
      }

      // Hide details for SystemMessage types
      if (hook.message_type === 'SystemMessage') {
        details = {}
      }

      return {
        id: hook.id,
        icon,
        iconColor,
        bgColor,
        title,
        details,
        timestamp: hook.received_at || new Date().toISOString(),
        status: hook.status,
        toolName: hook.tool_name,
        hookType: hook.hook_type,
        message: hook.message,
      }
    }).reverse()
  }, [thinkingHooks])

  // Don't render anything if no hooks
  if (!transformedHooks.length && !isLoading) {
    return null
  }

  // Show loading state
  if (isLoading && transformedHooks.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        className="mt-3"
      >
        <div className="flex items-center gap-2 text-xs text-muted-foreground p-3 bg-muted/30 rounded-lg">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Loading processing steps...</span>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="mt-3"
    >
      <StageHooksSection
        hooks={transformedHooks}
        accentColor="blue"
        title="Processing Steps"
        description={`${transformedHooks.length} step${transformedHooks.length !== 1 ? 's' : ''} executed`}
        onRefresh={() => refetch()}
        isRefreshing={isRefetching}
      />
    </motion.div>
  )
}
