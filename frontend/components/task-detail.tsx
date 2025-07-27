'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { 
  ChatBubbleIcon, FileIcon, RocketIcon, ActivityLogIcon, 
  UploadIcon, ReloadIcon, LockClosedIcon, ClockIcon,
  CheckCircledIcon, CrossCircledIcon, DotFilledIcon,
  PlayIcon, StopIcon, DownloadIcon, CommitIcon,
  ReaderIcon, UpdateIcon, LightningBoltIcon, CubeIcon,
  CodeIcon
} from '@radix-ui/react-icons'
import { motion } from 'framer-motion'
import { api, DeploymentHook } from '@/lib/api'
import { getGitHubUrl, parseGitUrl } from '@/lib/git-url-parser'
import { UploadZone } from './upload-zone'
import { SubProjectChat } from './sub-project-chat'
import { Skeleton } from './ui/skeleton'
import { Button } from './ui/button'
import { useState, useEffect, useMemo } from 'react'
import { DeploymentLogs } from './deployment-logs'

interface TaskDetailProps {
  projectId: string
  taskId: string
}

export function TaskDetail({ projectId, taskId }: TaskDetailProps) {
  const [activeTab, setActiveTab] = useState<'deployment' | 'chat' | 'knowledge-base'>('deployment')
  
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
  })

  const { data: subProjects, refetch: refetchSubProjects } = useQuery({
    queryKey: ['task-sub-projects', taskId],
    queryFn: () => api.getTaskSubProjects(taskId),
    enabled: !!task,
    refetchInterval: 5000, // Poll every 5 seconds to catch new sub_projects
  })

  // Fetch deployment hooks (poll if deployment is not completed)
  const { data: deploymentData, refetch: refetchHooks } = useQuery({
    queryKey: ['deployment-hooks', taskId],
    queryFn: () => api.getTaskDeploymentHooks(taskId, 100), // Get more hooks
    enabled: !!task && task.deployment_status !== 'pending', // Fetch hooks if deployment has started
    refetchInterval: task && !task.deployment_completed ? 3000 : false, // Poll every 3 seconds only if not completed
  })

  // Fetch knowledge base files
  const { data: knowledgeBaseFiles, refetch: refetchKnowledgeBase } = useQuery({
    queryKey: ['knowledge-base-files', taskId],
    queryFn: () => api.getKnowledgeBaseFiles(taskId),
    enabled: !!task && activeTab === 'knowledge-base',
  })

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
            { id: 'deployment', label: 'Summary', icon: <ActivityLogIcon className="h-3.5 sm:h-4 w-3.5 sm:w-4" /> },
            { id: 'chat', label: 'Chat', icon: <ChatBubbleIcon className="h-3.5 sm:h-4 w-3.5 sm:w-4" /> },
            { id: 'knowledge-base', label: 'Knowledge Base', icon: <ReaderIcon className="h-3.5 sm:h-4 w-3.5 sm:w-4" /> },
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
                  hooks={deploymentData?.hooks || []} 
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
                    <button
                      onClick={async () => {
                        try {
                          const result = await api.getTaskVSCodeLink(taskId)
                          window.open(result.tunnel_link, '_blank')
                        } catch (error) {
                          console.error('Failed to get VS Code link:', error)
                        }
                      }}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-black/20 hover:bg-black/30 transition-all border border-border/30 text-sm text-purple-400 hover:text-purple-300 group w-full"
                    >
                      <CodeIcon className="h-4 w-4 group-hover:scale-110 transition-transform" />
                      <span>Open in VS Code</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}

        {activeTab === 'chat' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <SubProjectChat
              projectName={project?.name || ''}
              taskName={task.name}
              subProjectId={subProjects?.sub_projects?.[0]?.id || `new-${taskId}`}
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
                orgName={project?.organization_name || 'default'}
                cwd={`${project?.name}/${task.name}-${task.id}`}
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
      </div>
    </motion.div>
  )
}