'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { 
  ChatBubbleIcon, FileIcon, RocketIcon, ActivityLogIcon, 
  UploadIcon, ReloadIcon, LockClosedIcon, ClockIcon,
  CheckCircledIcon, CrossCircledIcon, DotFilledIcon,
  PlayIcon, StopIcon, DownloadIcon, CommitIcon,
  ReaderIcon, UpdateIcon, LightningBoltIcon, CubeIcon,
  CodeIcon, TrashIcon, ChevronDownIcon, ChevronRightIcon,
  FileTextIcon, QuestionMarkCircledIcon
} from '@radix-ui/react-icons'
import { motion } from 'framer-motion'
import { api, DeploymentHook } from '@/lib/api'
import { getGitHubUrl, parseGitUrl } from '@/lib/git-url-parser'
import { UploadZone } from './upload-zone'
import { SubProjectChat } from './sub-project-chat'
import { Skeleton } from './ui/skeleton'
import { Button } from './ui/button'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { DeploymentLogs } from './deployment-logs'
import { TestCaseModal } from './test-case-modal'
import { ExecutionResultModal } from './execution-result-modal'
import { MarkdownRenderer } from './markdown-renderer'
import { ContestHarvestingTab } from './contest-harvesting-tab'
import { IssueResolutionView } from './issue-resolution-view'
import { MessagesTab } from './messages-tab'
import { VSCodeLinkModal } from './vscode-link-modal'
import { DeploymentTaskTab } from './deployment-task-tab'

interface TaskDetailProps {
  projectId: string
  taskId: string
}

export function TaskDetail({ projectId, taskId }: TaskDetailProps) {
  // Will be set to 'issue-resolution' for issue tasks after loading
  const [activeTab, setActiveTab] = useState<'deployment' | 'deployment-task' | 'chat' | 'knowledge-base' | 'test-cases' | 'contest-harvesting' | 'issue-resolution' | 'messages'>('deployment')
  
  // Helper function to format duration
  const formatDuration = (start: Date, end: Date) => {
    const diff = end.getTime() - start.getTime()
    const seconds = Math.floor(diff / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`
    } else {
      return `${seconds}s`
    }
  }

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => api.getProject(projectId),
  })

  const { data: task, isLoading, refetch: refetchTask } = useQuery({
    queryKey: ['task', taskId],
    queryFn: () => api.getTask(taskId),
    // Poll task status to catch deployment state changes
    refetchInterval: 5000, // Poll every 5 seconds
    refetchIntervalInBackground: true,
  })

  const { data: subProjects, refetch: refetchSubProjects } = useQuery({
    queryKey: ['task-sub-projects', taskId],
    queryFn: () => api.getTaskSubProjects(taskId),
    enabled: !!task,
    refetchInterval: 5000, // Poll every 5 seconds to catch new sub_projects
  })

  // Fetch deployment hooks (always poll if deployment is not completed)
  const shouldPollDeployment = task && task.deployment_status !== 'pending' && !task.deployment_completed
  const { data: deploymentData, refetch: refetchHooks } = useQuery({
    queryKey: ['deployment-hooks', taskId],
    queryFn: () => api.getTaskDeploymentHooks(taskId, 100), // Get more hooks
    enabled: !!task && task.deployment_status !== 'pending', // Fetch hooks if deployment has started
    refetchInterval: shouldPollDeployment ? 2000 : false, // Always poll every 2 seconds when deployment is running
    refetchIntervalInBackground: true, // Continue polling even when tab is not active
  })

  // Summary tab should only surface phases not already shown inside Deployment Task (e.g. initialization)
  const summaryHooks = useMemo(() => {
    if (!deploymentData?.hooks) return []
    return deploymentData.hooks.filter((hook) => hook.phase !== 'deployment')
  }, [deploymentData?.hooks])

  // Fetch knowledge base files
  const { data: knowledgeBaseFiles, refetch: refetchKnowledgeBase } = useQuery({
    queryKey: ['knowledge-base-files', taskId],
    queryFn: () => api.getKnowledgeBaseFiles(taskId),
    enabled: !!task && activeTab === 'knowledge-base',
  })

  // Fetch grouped test cases (poll if any test case is running)
  const { data: testCasesGrouped, refetch: refetchTestCases } = useQuery({
    queryKey: ['test-cases-grouped', taskId],
    queryFn: () => api.getTestCasesGrouped(taskId),
    enabled: !!task && activeTab === 'test-cases',
    refetchInterval: (query) => {
      const data = query.state.data
      const hasRunning = data?.sessions?.some((session: any) => 
        session.test_cases.some((tc: any) => tc.status === 'running')
      )
      return hasRunning ? 2000 : false // Poll every 2 seconds for running tests
    },
  })

  // State for expanded sessions (expand first session by default)
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set())

  // Initialize expanded sessions with the first session when test cases are loaded
  useEffect(() => {
    if (testCasesGrouped?.sessions?.length && testCasesGrouped.sessions.length > 0 && expandedSessions.size === 0) {
      setExpandedSessions(new Set([testCasesGrouped.sessions[0].session_id]))
    }
  }, [testCasesGrouped])

  // Toggle session expansion
  const toggleSession = useCallback((sessionId: string) => {
    setExpandedSessions(prev => {
      const newSet = new Set(prev)
      if (newSet.has(sessionId)) {
        newSet.delete(sessionId)
      } else {
        newSet.add(sessionId)
      }
      return newSet
    })
  }, [])

  // Set default tab for issue resolution tasks
  useEffect(() => {
    if (task?.task_type === 'issue_resolution' && activeTab === 'deployment') {
      setActiveTab('issue-resolution')
    }
  }, [task, activeTab])

  // Refetch task when deployment is completed
  useEffect(() => {
    if (deploymentData?.deployment_completed && task && !task.deployment_completed) {
      refetchTask()
    }
  }, [deploymentData?.deployment_completed, task, refetchTask])

  if (isLoading) {
    return (
      <div className="container mx-auto px-6 py-8">
        <div className="terminal-bg rounded-lg border border-border p-6 mb-8">
          <Skeleton className="h-6 w-64 mb-4" />
          <Skeleton className="h-4 w-96" />
        </div>
      </div>
    )
  }

  if (!task) {
    return (
      <div className="container mx-auto px-6 py-8">
        <div className="terminal-bg rounded-lg border border-border p-6">
          <div className="font-mono text-red-400">
            <span className="text-muted-foreground">$</span> Error: Task not found
          </div>
        </div>
      </div>
    )
  }

  // For issue resolution tasks, render the dedicated issue resolution UI
  if (task.task_type === 'issue_resolution') {
    return (
      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <IssueResolutionView projectId={projectId} taskId={taskId} />
      </div>
    )
  }

  const projectSlug = project?.name.toLowerCase().replace(/\s+/g, '-') || ''
  const taskSlug = task.name.toLowerCase().replace(/\s+/g, '-')

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="container mx-auto px-4 sm:px-6 py-6 sm:py-8"
    >
      {/* Breadcrumb - Mobile Optimized */}
      <nav className="flex items-center space-x-1 sm:space-x-2 text-xs sm:text-sm font-mono mb-4 sm:mb-6 overflow-x-auto">
        <Link href="/" className="text-muted-foreground hover:text-cyan-500 transition-colors whitespace-nowrap">
          ~/projects
        </Link>
        <span className="text-muted-foreground">/</span>
        <Link href={`/p/${projectId}`} className="text-muted-foreground hover:text-cyan-500 transition-colors whitespace-nowrap">
          {projectSlug}
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="text-cyan-500 whitespace-nowrap">tasks/{taskSlug}</span>
      </nav>

      {/* Modern Task Header - Mobile Friendly */}
      <div className="relative mb-6">
        {/* Background Gradient Effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-purple-500/10 to-cyan-500/10 rounded-xl md:rounded-2xl blur-xl" />
        
        <div className="relative bg-card/90 backdrop-blur-xl rounded-xl md:rounded-2xl border border-border/50 overflow-hidden">
          {/* Status Bar */}
          <div className={`h-1 ${
            task.deployment_status === 'completed' ? 'bg-gradient-to-r from-green-400 to-green-600' :
            task.deployment_status === 'failed' ? 'bg-gradient-to-r from-red-400 to-red-600' :
            task.deployment_status === 'deploying' || task.deployment_status === 'initializing' ? 'bg-gradient-to-r from-yellow-400 to-orange-500 animate-pulse' :
            'bg-gradient-to-r from-gray-400 to-gray-600'
          }`} />
          
          <div className="p-4 md:p-6 lg:p-8">
            {/* Task Title and Status - Mobile Optimized */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
                  {task.name}
                </h1>
                {task.deployment_status === 'completed' ? (
                  <motion.span 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="inline-flex items-center px-2.5 py-1 rounded-full text-xs sm:text-sm font-medium bg-green-500/20 text-green-400 border border-green-500/30 shadow-[0_0_15px_rgba(34,197,94,0.3)] self-start sm:self-auto"
                  >
                    <CheckCircledIcon className="h-3.5 w-3.5 mr-1" />
                    Success
                  </motion.span>
                ) : task.deployment_status === 'failed' ? (
                  <motion.span 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="inline-flex items-center px-2.5 py-1 rounded-full text-xs sm:text-sm font-medium bg-red-500/20 text-red-400 border border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.3)] self-start sm:self-auto"
                  >
                    <CrossCircledIcon className="h-3.5 w-3.5 mr-1" />
                    Failed
                  </motion.span>
                ) : task.deployment_status === 'deploying' || task.deployment_status === 'initializing' ? (
                  <motion.span 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="inline-flex items-center px-2.5 py-1 rounded-full text-xs sm:text-sm font-medium bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 shadow-[0_0_15px_rgba(245,158,11,0.3)] self-start sm:self-auto"
                  >
                    <UpdateIcon className="h-3.5 w-3.5 mr-1 animate-spin" />
                    In Progress
                  </motion.span>
                ) : (
                  <motion.span 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="inline-flex items-center px-2.5 py-1 rounded-full text-xs sm:text-sm font-medium bg-gray-500/20 text-gray-400 border border-gray-500/30 self-start sm:self-auto"
                  >
                    <ClockIcon className="h-3.5 w-3.5 mr-1" />
                    Queued
                  </motion.span>
                )}
              </div>
              
              {/* Retry Button - Mobile Positioned */}
              {task.deployment_status === 'failed' && (
                <Button
                  onClick={() => api.retryTaskDeployment(taskId).then(() => refetchTask())}
                  size="sm"
                  className="self-start sm:self-auto bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white border-0 shadow-lg text-xs sm:text-sm"
                >
                  <ReloadIcon className="h-3 w-3 mr-1" />
                  Retry
                </Button>
              )}
            </div>
            
            {/* Task Metadata Grid - Responsive */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-black/20 rounded-lg p-2.5 sm:p-3 border border-border/30">
                <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-muted-foreground mb-0.5">
                  <CommitIcon className="h-3 w-3" />
                  <span>Task ID</span>
                </div>
                <span className="font-mono text-xs sm:text-sm text-cyan-400">{task.id.slice(0, 8)}</span>
              </div>
              
              <div className="bg-black/20 rounded-lg p-2.5 sm:p-3 border border-border/30">
                <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-muted-foreground mb-0.5">
                  <ClockIcon className="h-3 w-3" />
                  <span>Created</span>
                </div>
                <span className="text-xs sm:text-sm">
                  {new Date(task.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>
              
              {task.deployment_completed_at && (
                <div className="bg-black/20 rounded-lg p-2.5 sm:p-3 border border-border/30">
                  <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-muted-foreground mb-0.5">
                    <LightningBoltIcon className="h-3 w-3" />
                    <span>Duration</span>
                  </div>
                  <span className="text-xs sm:text-sm text-yellow-400">
                    {formatDuration(
                      new Date(task.deployment_started_at || task.created_at),
                      new Date(task.deployment_completed_at)
                    )}
                  </span>
                </div>
              )}
              
              {deploymentData && (() => {
                const totalCost = deploymentData.hooks.reduce((sum, hook) => 
                  sum + (hook.data?.total_cost_usd || 0), 0
                )
                return totalCost > 0 ? (
                  <div className="bg-black/20 rounded-lg p-2.5 sm:p-3 border border-border/30">
                    <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-muted-foreground mb-0.5">
                      <ActivityLogIcon className="h-3 w-3" />
                      <span>Total Cost</span>
                    </div>
                    <span className="text-xs sm:text-sm text-green-400">${totalCost.toFixed(4)}</span>
                  </div>
                ) : null
              })()}
            </div>
            
            {/* MCP Servers - Mobile Optimized */}
            {task.mcp_servers && task.mcp_servers.length > 0 && (
              <div className="space-y-2">
                <span className="text-xs sm:text-sm text-muted-foreground">MCP Servers:</span>
                <div className="flex flex-wrap gap-2">
                  {task.mcp_servers.map((server: any) => (
                    <motion.span
                      key={server.server_type}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] sm:text-xs font-medium bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-blue-400 border border-blue-500/30"
                    >
                      <CubeIcon className="h-3 w-3 mr-1" />
                      {server.server_type}
                      {server.access_token && <LockClosedIcon className="h-3 w-3 ml-1 text-yellow-400" />}
                    </motion.span>
                  ))}
                </div>
              </div>
            )}
            
            {/* Progress Bar for Active Deployments */}
            {(task.deployment_status === 'deploying' || task.deployment_status === 'initializing') && deploymentData && (
              <div className="mt-4">
                <div className="flex items-center justify-between text-[10px] sm:text-xs text-muted-foreground mb-2">
                  <span>Deployment Progress</span>
                  <span>{deploymentData.hooks.length} events</span>
                </div>
                <div className="h-1.5 sm:h-2 bg-black/30 rounded-full overflow-hidden">
                  <motion.div 
                    className="h-full bg-gradient-to-r from-cyan-500 to-purple-500"
                    initial={{ width: '0%' }}
                    animate={{ width: '60%' }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modern Tab Navigation - Mobile Optimized */}
      <div className="bg-card/50 backdrop-blur-sm rounded-lg sm:rounded-xl border border-border/50 p-1 mb-6 sm:mb-8 overflow-x-auto">
        <div className="flex space-x-1 min-w-max">
          {[
            // Show Issue Resolution tab first for issue tasks
            ...(task.task_type === 'issue_resolution' ? [
              { id: 'issue-resolution', label: 'Issue Resolution', icon: <FileTextIcon className="h-3.5 sm:h-4 w-3.5 sm:w-4" /> },
            ] : []),
            // Show Messages tab for issue resolution tasks
            ...(task.task_type === 'issue_resolution' ? [
              { id: 'messages', label: 'Messages', icon: <ChatBubbleIcon className="h-3.5 sm:h-4 w-3.5 sm:w-4" /> },
            ] : []),
            // Show deployment tab for non-issue tasks
            ...(task.task_type !== 'issue_resolution' ? [
              { id: 'deployment', label: 'Summary', icon: <ActivityLogIcon className="h-3.5 sm:h-4 w-3.5 sm:w-4" /> },
            ] : []),
            // Show Deployment Task tab for all tasks
            { id: 'deployment-task', label: 'Deployment Task', icon: <RocketIcon className="h-3.5 sm:h-4 w-3.5 sm:w-4" /> },
            // Hide Chat tab for issue resolution tasks - they have integrated chat
            ...(task.task_type !== 'issue_resolution' ? [
              { id: 'chat', label: 'Chat', icon: <ChatBubbleIcon className="h-3.5 sm:h-4 w-3.5 sm:w-4" /> },
            ] : []),
            { id: 'knowledge-base', label: 'Knowledge Base', icon: <ReaderIcon className="h-3.5 sm:h-4 w-3.5 sm:w-4" /> },
            { id: 'test-cases', label: 'Test Cases', icon: <PlayIcon className="h-3.5 sm:h-4 w-3.5 sm:w-4" /> },
            { id: 'contest-harvesting', label: 'Context Harvesting', icon: <QuestionMarkCircledIcon className="h-3.5 sm:h-4 w-3.5 sm:w-4" /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-md sm:rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-cyan-500/20 to-purple-500/20 text-foreground border border-cyan-500/30 shadow-lg'
                  : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {activeTab === 'deployment' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          >
            {/* Main content - 2 columns */}
            <div className="lg:col-span-2">
              {task.deployment_status === 'pending' ? (
                <div className="bg-card rounded-lg border border-border p-12 text-center">
                  <ClockIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium mb-2">Deployment Queued</h3>
                  <p className="text-sm text-muted-foreground">
                    Your deployment will start automatically.
                  </p>
                </div>
              ) : (
                <DeploymentLogs 
                  hooks={summaryHooks}
                  isCompleted={task.deployment_completed}
                  status={task.deployment_status}
                />
              )}
            </div>
            
            {/* Sidebar - 1 column */}
            <div className="space-y-4">
              {/* Run Summary with Enhanced Design */}
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-gradient-to-br from-card to-card/80 rounded-xl border border-border/50 p-5 backdrop-blur-sm"
              >
                <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                  <ActivityLogIcon className="h-4 w-4 text-cyan-400" />
                  Run Summary
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Status</span>
                    <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium ${
                      task.deployment_status === 'completed' ? 'bg-green-500/20 text-green-400' :
                      task.deployment_status === 'failed' ? 'bg-red-500/20 text-red-400' :
                      task.deployment_status === 'deploying' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-gray-500/20 text-gray-400'
                    }`}>
                      {task.deployment_status === 'completed' && <CheckCircledIcon className="h-3 w-3" />}
                      {task.deployment_status === 'failed' && <CrossCircledIcon className="h-3 w-3" />}
                      {task.deployment_status === 'deploying' && <UpdateIcon className="h-3 w-3 animate-spin" />}
                      {task.deployment_status === 'pending' && <ClockIcon className="h-3 w-3" />}
                      {task.deployment_status.charAt(0).toUpperCase() + task.deployment_status.slice(1)}
                    </div>
                  </div>
                  
                  {task.deployment_started_at && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Started</span>
                      <span className="font-mono text-xs text-cyan-400">
                        {new Date(task.deployment_started_at).toLocaleTimeString()}
                      </span>
                    </div>
                  )}
                  
                  {task.deployment_completed_at && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Duration</span>
                      <span className="font-mono text-xs text-yellow-400">
                        {formatDuration(
                          new Date(task.deployment_started_at || task.created_at),
                          new Date(task.deployment_completed_at)
                        )}
                      </span>
                    </div>
                  )}
                  
                  {deploymentData && (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Total Events</span>
                        <span className="font-mono text-xs text-purple-400">{deploymentData.hooks.length}</span>
                      </div>
                      
                      {/* Calculate total cost if available */}
                      {(() => {
                        const totalCost = deploymentData.hooks.reduce((sum, hook) => 
                          sum + (hook.data?.total_cost_usd || 0), 0
                        )
                        return totalCost > 0 ? (
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Total Cost</span>
                            <span className="font-mono text-xs text-green-400">
                              ${totalCost.toFixed(4)}
                            </span>
                          </div>
                        ) : null
                      })()}
                    </>
                  )}
                </div>
              </motion.div>
              
              {/* Artifacts with Enhanced Design */}
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-gradient-to-br from-card to-card/80 rounded-xl border border-border/50 p-5 backdrop-blur-sm"
              >
                <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                  <FileIcon className="h-4 w-4 text-purple-400" />
                  Artifacts
                </h3>
                <div className="space-y-2">
                  <button className="w-full text-left px-3 py-2.5 rounded-lg bg-black/20 hover:bg-black/30 transition-all border border-border/30 group">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileIcon className="h-4 w-4 text-muted-foreground group-hover:text-cyan-400 transition-colors" />
                        <span className="text-sm">deployment-logs.txt</span>
                      </div>
                      <DownloadIcon className="h-3 w-3 text-muted-foreground group-hover:text-cyan-400 transition-colors" />
                    </div>
                  </button>
                </div>
              </motion.div>
              
              {/* Repository Info with Enhanced Design */}
              {project && (
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                  className="bg-gradient-to-br from-card to-card/80 rounded-xl border border-border/50 p-5 backdrop-blur-sm"
                >
                  <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                    <CommitIcon className="h-4 w-4 text-blue-400" />
                    Repository
                  </h3>
                  <div className="space-y-2">
                    <a
                      href={getGitHubUrl(project.repo_url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-black/20 hover:bg-black/30 transition-all border border-border/30 text-sm text-blue-400 hover:text-blue-300 group w-full"
                    >
                      <CommitIcon className="h-4 w-4 group-hover:rotate-12 transition-transform" />
                      <span className="truncate">{(() => {
                        const gitInfo = parseGitUrl(project.repo_url)
                        return gitInfo ? `${gitInfo.owner}/${gitInfo.repo}` : project.repo_url
                      })()}</span>
                    </a>
                    <VSCodeLinkModal
                      taskId={taskId}
                      trigger={
                        <button className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-black/20 hover:bg-black/30 transition-all border border-border/30 text-sm text-purple-400 hover:text-purple-300 group w-full">
                          <CodeIcon className="h-4 w-4 group-hover:scale-110 transition-transform" />
                          <span>Open in VS Code</span>
                        </button>
                      }
                    />
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}

        {activeTab === 'chat' && task.task_type !== 'issue_resolution' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <SubProjectChat
              projectName={project?.name || ''}
              taskName={task.name}
              subProjectId={subProjects?.sub_projects?.[0]?.id || `new-${taskId}`}
              taskId={taskId}
            />
          </motion.div>
        )}

        {activeTab === 'knowledge-base' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div>
              <h3 className="text-lg font-mono font-semibold flex items-center space-x-2 mb-4">
                <ReaderIcon className="h-5 w-5 text-cyan-500" />
                <span>Knowledge Base</span>
              </h3>
              <p className="text-sm text-muted-foreground mb-6">
                Upload documents to the .claude folder for automatic reference by Claude when processing queries for this task.
              </p>
            </div>

            {/* Upload Zone for Knowledge Base */}
            <div className="bg-card rounded-lg border border-border p-6">
              <h4 className="text-sm font-medium mb-4">Upload to Knowledge Base</h4>
              <UploadZone
                onUpload={async (file) => {
                  try {
                    const result = await api.uploadToKnowledgeBase(taskId, file)
                    refetchKnowledgeBase()
                    return result
                  } catch (error) {
                    console.error('Knowledge base upload failed:', error)
                    throw error
                  }
                }}
                acceptedFileTypes={{
                  'text/*': ['.txt', '.md', '.mdx', '.json', '.yaml', '.yml', '.xml', '.csv'],
                  'application/pdf': ['.pdf'],
                  'application/json': ['.json'],
                  'application/xml': ['.xml'],
                  'application/x-yaml': ['.yaml', '.yml'],
                  'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.tiff', '.heic', '.heif'],
                }}
              />
            </div>

            {/* Knowledge Base Files List */}
            <div className="bg-card rounded-lg border border-border p-6">
              <h4 className="text-sm font-medium mb-4">Knowledge Base Files</h4>
              {knowledgeBaseFiles?.files && knowledgeBaseFiles.files.length > 0 ? (
                <div className="space-y-2">
                  {knowledgeBaseFiles.files.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <FileIcon className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">{file.file_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(file.size_bytes / 1024).toFixed(1)} KB • Uploaded {new Date(file.uploaded_at).toLocaleDateString()}
                            {file.content_type && ` • ${file.content_type}`}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No files in knowledge base yet. Upload files above to get started.
                </p>
              )}
            </div>
          </motion.div>
        )}

        {activeTab === 'deployment-task' && task && (
          <DeploymentTaskTab taskId={taskId} task={task} />
        )}

        {activeTab === 'contest-harvesting' && (
          <ContestHarvestingTab taskId={taskId} />
        )}

        {activeTab === 'issue-resolution' && (
          <IssueResolutionView projectId={projectId} taskId={taskId} />
        )}

        {activeTab === 'messages' && (
          <MessagesTab projectId={projectId} taskId={taskId} />
        )}

        {activeTab === 'test-cases' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4 sm:space-y-6"
          >
            {/* Enhanced Mobile-Optimized Header */}
            <div className="space-y-4 sm:space-y-5">
              <div className="flex items-center gap-3">
                <div className="bg-gradient-to-r from-cyan-500/20 to-purple-500/20 p-3 rounded-xl border border-cyan-500/30">
                  <PlayIcon className="h-6 w-6 text-cyan-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
                    Test Cases
                  </h3>
                  <p className="text-sm sm:text-base text-muted-foreground mt-1 leading-relaxed">
                    Automated quality assurance and verification
                  </p>
                </div>
              </div>
              
              <div className="bg-gradient-to-r from-cyan-500/5 to-purple-500/5 rounded-lg p-4 border border-cyan-500/20">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Create and manage test cases for this task. Each test case can be executed to verify functionality and ensure quality standards.
                </p>
                <div className="hidden sm:flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-green-400" />
                    Automated execution
                  </span>
                  <span className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-blue-400" />
                    Real-time results
                  </span>
                  <span className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-purple-400" />
                    Quality assurance
                  </span>
                </div>
              </div>
            </div>

            {/* Enhanced Mobile-Optimized Test Cases Container */}
            <div className="bg-gradient-to-br from-card/80 to-card rounded-xl border border-border/50 p-4 sm:p-6 backdrop-blur-sm">
              {/* Enhanced Header with Responsive Button */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                  <div className="bg-gradient-to-r from-cyan-500/20 to-purple-500/20 p-2.5 rounded-lg">
                    <PlayIcon className="h-5 w-5 text-cyan-400" />
                  </div>
                  <div>
                    <h4 className="text-base sm:text-lg font-semibold text-foreground">Test Cases</h4>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      {testCasesGrouped?.total_test_cases || 0} test case{(testCasesGrouped?.total_test_cases || 0) !== 1 ? 's' : ''} configured
                    </p>
                  </div>
                </div>
                <TestCaseModal
                  taskId={taskId}
                  onSuccess={refetchTestCases}
                  trigger={
                    <Button
                      size="default"
                      className="w-full sm:w-auto bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 hover:from-cyan-600 hover:via-blue-600 hover:to-purple-600 text-white border-0 font-medium h-11 sm:h-10 shadow-lg hover:shadow-xl transition-all duration-200"
                    >
                      <PlayIcon className="h-4 w-4 mr-2" />
                      <span className="hidden sm:inline">New Test Case</span>
                      <span className="sm:hidden">New Test</span>
                    </Button>
                  }
                />
              </div>

              {testCasesGrouped && testCasesGrouped.total_test_cases > 0 ? (
                <div className="space-y-4">
                  {/* Session Controls */}
                  {testCasesGrouped.session_count > 1 && (
                    <div className="flex items-center justify-between p-2 bg-card/50 rounded-lg border border-border/30">
                      <span className="text-sm text-muted-foreground ml-2">
                        {testCasesGrouped.session_count} sessions • {testCasesGrouped.total_test_cases} total test cases
                      </span>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            const allSessionIds = testCasesGrouped.sessions.map((s: any) => s.session_id)
                            setExpandedSessions(new Set(allSessionIds))
                          }}
                          className="h-7 px-2 text-xs text-cyan-400 hover:text-cyan-300"
                        >
                          <ChevronDownIcon className="h-3 w-3 mr-1" />
                          Expand All
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setExpandedSessions(new Set())}
                          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                        >
                          <ChevronRightIcon className="h-3 w-3 mr-1" />
                          Collapse All
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Sessions (Folders) */}
                  {testCasesGrouped.sessions.map((session: any) => (
                    <div key={session.session_id} className="space-y-2">
                      {/* Session Header */}
                      <button
                        onClick={() => toggleSession(session.session_id)}
                        className="w-full flex items-center justify-between p-3 bg-gradient-to-r from-card/60 to-card/80 backdrop-blur-sm rounded-lg border border-border/50 hover:border-cyan-500/30 transition-all duration-200"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex items-center">
                            {expandedSessions.has(session.session_id) ? (
                              <ChevronDownIcon className="h-4 w-4 text-cyan-400" />
                            ) : (
                              <ChevronRightIcon className="h-4 w-4 text-cyan-400" />
                            )}
                          </div>
                          <div className={`p-2 rounded-lg ${
                            session.is_ai_generated 
                              ? 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30' 
                              : 'bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border border-blue-500/30'
                          }`}>
                            {session.is_ai_generated ? (
                              <LightningBoltIcon className="h-4 w-4 text-purple-400" />
                            ) : (
                              <FileTextIcon className="h-4 w-4 text-blue-400" />
                            )}
                          </div>
                          <div className="flex flex-col items-start">
                            <span className="font-semibold text-sm sm:text-base text-foreground">
                              {session.display_name}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {session.test_case_count} test case{session.test_case_count !== 1 ? 's' : ''}
                              {session.is_ai_generated && ' • AI Generated'}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {/* Session stats */}
                          {session.test_cases.some((tc: any) => tc.status === 'passed') && (
                            <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full">
                              {session.test_cases.filter((tc: any) => tc.status === 'passed').length} passed
                            </span>
                          )}
                          {session.test_cases.some((tc: any) => tc.status === 'failed') && (
                            <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded-full">
                              {session.test_cases.filter((tc: any) => tc.status === 'failed').length} failed
                            </span>
                          )}
                          {session.test_cases.some((tc: any) => tc.status === 'running') && (
                            <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 text-xs rounded-full animate-pulse">
                              {session.test_cases.filter((tc: any) => tc.status === 'running').length} running
                            </span>
                          )}
                        </div>
                      </button>

                      {/* Session Actions */}
                      {expandedSessions.has(session.session_id) && session.test_cases.length > 0 && (
                        <div className="flex justify-end gap-2 pl-6 pb-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async (e) => {
                              e.stopPropagation()
                              const pendingTests = session.test_cases.filter((tc: any) => 
                                tc.status === 'pending' || tc.status === 'failed'
                              )
                              if (pendingTests.length > 0) {
                                if (confirm(`Execute ${pendingTests.length} test case(s) in this session?`)) {
                                  for (const testCase of pendingTests) {
                                    try {
                                      await api.executeTestCase(testCase.id)
                                    } catch (error) {
                                      console.error('Failed to execute test case:', error)
                                    }
                                  }
                                  // Refetch after executing all
                                  setTimeout(() => refetchTestCases(), 1000)
                                }
                              }
                            }}
                            disabled={!session.test_cases.some((tc: any) => tc.status === 'pending' || tc.status === 'failed')}
                            className="h-8 text-xs"
                          >
                            <PlayIcon className="h-3 w-3 mr-1" />
                            Run All in Session
                          </Button>
                        </div>
                      )}

                      {/* Test Cases in Session */}
                      {expandedSessions.has(session.session_id) && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="pl-6 space-y-3"
                        >
                          {session.test_cases.map((testCase: any) => (
                    <motion.div
                      key={testCase.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="group bg-gradient-to-br from-card/60 via-card/80 to-card/60 backdrop-blur-sm rounded-xl border border-border/50 p-4 sm:p-5 hover:shadow-xl hover:shadow-cyan-500/10 hover:border-cyan-500/30 transition-all duration-300"
                    >
                      {/* Enhanced Mobile-First Test Case Card */}
                      <div className="space-y-4">
                        {/* Enhanced Title and Status Row */}
                        <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start gap-3">
                              <div className={`w-3 h-3 rounded-full mt-1 shrink-0 ${
                                testCase.status === 'passed' ? 'bg-green-400' :
                                testCase.status === 'failed' ? 'bg-red-400' :
                                testCase.status === 'running' ? 'bg-yellow-400 animate-pulse' :
                                'bg-gray-400'
                              }`} />
                              <div className="flex-1 min-w-0">
                                <h5 className="font-semibold text-base sm:text-lg text-foreground line-clamp-2 leading-snug">
                                  {testCase.title}
                                </h5>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold self-start shrink-0 shadow-md ${
                              testCase.status === 'passed' ? 'bg-gradient-to-r from-green-500/30 to-emerald-500/30 text-green-300 border border-green-400/40 shadow-green-500/20' :
                              testCase.status === 'failed' ? 'bg-gradient-to-r from-red-500/30 to-rose-500/30 text-red-300 border border-red-400/40 shadow-red-500/20' :
                              testCase.status === 'running' ? 'bg-gradient-to-r from-yellow-500/30 to-orange-500/30 text-yellow-300 border border-yellow-400/40 shadow-yellow-500/20' :
                              'bg-gradient-to-r from-gray-500/30 to-slate-500/30 text-gray-300 border border-gray-400/40'
                            }`}>
                              {testCase.status === 'passed' && <CheckCircledIcon className="h-3.5 w-3.5 mr-1.5" />}
                              {testCase.status === 'failed' && <CrossCircledIcon className="h-3.5 w-3.5 mr-1.5" />}
                              {testCase.status === 'running' && <UpdateIcon className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                              {testCase.status === 'pending' && <ClockIcon className="h-3.5 w-3.5 mr-1.5" />}
                              <span className="hidden sm:inline">
                                {testCase.status.charAt(0).toUpperCase() + testCase.status.slice(1)}
                              </span>
                              <span className="sm:hidden">
                                {testCase.status === 'running' ? 'Run' : testCase.status.charAt(0).toUpperCase()}
                              </span>
                            </span>
                          </div>
                        </div>
                        
                        {/* Enhanced Description */}
                        {testCase.description && (
                          <div className="bg-gradient-to-r from-black/10 to-black/20 rounded-lg p-3 border border-border/30">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                              <span className="text-xs font-medium text-muted-foreground">Description</span>
                            </div>
                            <p className="text-sm text-foreground/90 leading-relaxed">
                              {testCase.description}
                            </p>
                          </div>
                        )}
                        
                        {/* Enhanced Execution Result Preview with Click-to-Expand */}
                        {testCase.execution_result && (
                          <div className="bg-gradient-to-r from-black/15 to-black/25 rounded-lg border border-border/30 overflow-hidden">
                            <div className="flex items-center justify-between p-3 pb-2">
                              <div className="flex items-center gap-2">
                                <div className={`w-1.5 h-1.5 rounded-full ${
                                  testCase.status === 'passed' ? 'bg-green-400' :
                                  testCase.status === 'failed' ? 'bg-red-400' :
                                  'bg-yellow-400'
                                }`} />
                                <span className="text-xs font-medium text-muted-foreground">Execution Result</span>
                              </div>
                              {testCase.execution_result.length > 200 && (
                                <ExecutionResultModal
                                  testCase={testCase}
                                  trigger={
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 px-2 text-xs text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10"
                                    >
                                      <ReaderIcon className="h-3 w-3 mr-1" />
                                      Full View
                                    </Button>
                                  }
                                />
                              )}
                            </div>
                            <div className="px-3 pb-3">
                              {testCase.execution_result.length > 200 ? (
                                <div className="space-y-2">
                                  <MarkdownRenderer 
                                    content={testCase.execution_result.substring(0, 200) + '...'}
                                    className="text-sm"
                                    compact={true}
                                  />
                                  <ExecutionResultModal
                                    testCase={testCase}
                                    trigger={
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="w-full h-8 text-xs border-dashed border-cyan-500/30 hover:border-cyan-400/50 text-cyan-400 hover:text-cyan-300 bg-transparent hover:bg-cyan-500/10"
                                      >
                                        <ReaderIcon className="h-3 w-3 mr-1.5" />
                                        Click to view complete result ({testCase.execution_result.length} chars)
                                      </Button>
                                    }
                                  />
                                </div>
                              ) : (
                                <MarkdownRenderer 
                                  content={testCase.execution_result}
                                  className="text-sm"
                                  compact={true}
                                />
                              )}
                            </div>
                          </div>
                        )}
                        
                        {/* No Execution Result - Provide Insight */}
                        {!testCase.execution_result && testCase.status !== 'pending' && (
                          <div className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 rounded-lg p-3 border border-yellow-500/30">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                              <span className="text-xs font-medium text-muted-foreground">Execution Status</span>
                            </div>
                            {testCase.status === 'running' ? (
                              <div className="space-y-3">
                                <p className="text-sm text-foreground/80 leading-relaxed">
                                  <span className="flex items-center gap-2">
                                    <UpdateIcon className="h-3.5 w-3.5 animate-spin" />
                                    Test is currently running...
                                  </span>
                                </p>
                                <ExecutionResultModal
                                  testCase={testCase}
                                  trigger={
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="w-full h-8 text-xs border-dashed border-blue-500/30 hover:border-blue-400/50 text-blue-400 hover:text-blue-300 bg-transparent hover:bg-blue-500/10"
                                    >
                                      <UpdateIcon className="h-3 w-3 mr-1.5 animate-spin" />
                                      View Live Progress
                                    </Button>
                                  }
                                />
                              </div>
                            ) : (
                              <p className="text-sm text-foreground/80 leading-relaxed">
                                {testCase.status === 'failed' ? (
                                  'Test execution failed - no result available'
                                ) : testCase.status === 'passed' ? (
                                  'Test passed but no detailed result was captured'
                                ) : (
                                  'Test has not been executed yet'
                                )}
                              </p>
                            )}
                          </div>
                        )}
                        
                        {/* Enhanced Metadata */}
                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1.5 bg-black/20 px-2.5 py-1.5 rounded-lg">
                            <ClockIcon className="h-3 w-3 text-cyan-400" />
                            <span>Created {new Date(testCase.created_at).toLocaleDateString()}</span>
                          </div>
                          {testCase.last_execution_at && (
                            <div className="flex items-center gap-1.5 bg-black/20 px-2.5 py-1.5 rounded-lg">
                              <ActivityLogIcon className="h-3 w-3 text-purple-400" />
                              <span>Last run {new Date(testCase.last_execution_at).toLocaleDateString()}</span>
                            </div>
                          )}
                        </div>
                        
                        {/* Enhanced Mobile-Optimized Action Buttons */}
                        <div className="flex flex-col gap-3 pt-4 border-t border-border/30">
                          {/* Primary Action - Execute (Full Width on Mobile) */}
                          <Button
                            onClick={async () => {
                              try {
                                await api.executeTestCase(testCase.id)
                                // Immediate refetch to update status
                                await refetchTestCases()
                                // Additional refetch after a short delay to ensure backend has updated
                                setTimeout(() => refetchTestCases(), 1000)
                                // And another refetch after 3 seconds to catch any delayed status updates
                                setTimeout(() => refetchTestCases(), 3000)
                              } catch (error) {
                                console.error('Failed to execute test case:', error)
                              }
                            }}
                            size="default"
                            disabled={testCase.status === 'running'}
                            className={`w-full h-12 sm:h-11 font-semibold text-sm sm:text-base shadow-lg hover:shadow-xl transition-all duration-200 ${
                              testCase.status === 'running' 
                                ? 'bg-gradient-to-r from-yellow-500/30 to-orange-500/30 border-yellow-500/40 text-yellow-300 cursor-not-allowed' 
                                : 'bg-gradient-to-r from-green-500 via-emerald-500 to-green-600 hover:from-green-600 hover:via-emerald-600 hover:to-green-700 text-white border-0'
                            }`}
                          >
                            {testCase.status === 'running' ? (
                              <>
                                <UpdateIcon className="h-5 w-5 mr-2 animate-spin" />
                                <span className="hidden sm:inline">Test Running...</span>
                                <span className="sm:hidden">Running...</span>
                              </>
                            ) : (
                              <>
                                <PlayIcon className="h-5 w-5 mr-2" />
                                <span className="hidden sm:inline">Execute Test Case</span>
                                <span className="sm:hidden">Execute Test</span>
                              </>
                            )}
                          </Button>
                          
                          {/* Secondary Actions Row */}
                          <div className="flex gap-2">
                            <TestCaseModal
                              taskId={taskId}
                              testCase={testCase}
                              onSuccess={refetchTestCases}
                              trigger={
                                <Button
                                  size="default"
                                  variant="outline"
                                  className="flex-1 h-11 sm:h-10 font-medium text-sm border-border/60 hover:border-cyan-400/50 hover:text-cyan-400 transition-all duration-200"
                                >
                                  <CodeIcon className="h-4 w-4 mr-2" />
                                  <span className="hidden sm:inline">Edit Test</span>
                                  <span className="sm:hidden">Edit</span>
                                </Button>
                              }
                            />
                            <Button
                              onClick={async () => {
                                if (confirm('Are you sure you want to delete this test case?')) {
                                  try {
                                    await api.deleteTestCase(testCase.id)
                                    refetchTestCases()
                                  } catch (error) {
                                    console.error('Failed to delete test case:', error)
                                  }
                                }
                              }}
                              size="default"
                              variant="ghost"
                              className="flex-1 h-11 sm:h-10 font-medium text-sm text-red-400 hover:text-red-300 hover:bg-red-500/20 border border-red-500/30 hover:border-red-400/50 transition-all duration-200"
                            >
                              <TrashIcon className="h-4 w-4 mr-2" />
                              <span className="hidden sm:inline">Delete</span>
                              <span className="sm:hidden">Del</span>
                            </Button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                          ))}
                        </motion.div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                /* Enhanced Empty State - Mobile Optimized */
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-12 sm:py-16 px-4"
                >
                  <div className="relative mx-auto mb-6">
                    <div className="bg-gradient-to-br from-cyan-500/20 via-blue-500/20 to-purple-500/20 rounded-full w-20 h-20 sm:w-24 sm:h-24 mx-auto flex items-center justify-center border border-cyan-500/30 backdrop-blur-sm">
                      <PlayIcon className="h-10 w-10 sm:h-12 sm:w-12 text-cyan-400" />
                    </div>
                    <div className="absolute -top-1 -right-1 w-6 h-6 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center animate-pulse">
                      <span className="text-white text-xs font-bold">+</span>
                    </div>
                  </div>
                  
                  <div className="space-y-4 mb-8">
                    <h4 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
                      No Test Cases Yet
                    </h4>
                    <div className="space-y-2 max-w-md mx-auto">
                      <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                        Start building quality assurance by creating your first test case.
                      </p>
                      <p className="text-xs text-muted-foreground/80">
                        Test cases help ensure your code works as expected.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <TestCaseModal
                      taskId={taskId}
                      onSuccess={refetchTestCases}
                      trigger={
                        <Button
                          size="default"
                          className="w-full sm:w-auto bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 hover:from-cyan-600 hover:via-blue-600 hover:to-purple-600 text-white border-0 font-semibold h-12 sm:h-11 px-8 shadow-lg hover:shadow-xl transition-all duration-200"
                        >
                          <PlayIcon className="h-5 w-5 mr-2" />
                          <span className="hidden sm:inline">Create Your First Test Case</span>
                          <span className="sm:hidden">Create Test Case</span>
                        </Button>
                      }
                    />
                    
                    {/* Mobile-Only Quick Tips */}
                    <div className="sm:hidden bg-gradient-to-r from-cyan-500/5 to-purple-500/5 rounded-lg p-4 border border-cyan-500/20 max-w-sm mx-auto">
                      <p className="text-xs font-semibold text-foreground mb-2">💡 Test Case Ideas:</p>
                      <ul className="text-xs text-muted-foreground space-y-1">
                        <li>• Login functionality</li>
                        <li>• Form validation</li>
                        <li>• API responses</li>
                        <li>• UI interactions</li>
                      </ul>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </div>

    </motion.div>
  )
}
