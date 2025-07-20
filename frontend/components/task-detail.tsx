'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { 
  ChatBubbleIcon, FileIcon, RocketIcon, ActivityLogIcon, 
  UploadIcon, ReloadIcon, LockClosedIcon, ClockIcon,
  CheckCircledIcon, CrossCircledIcon, DotFilledIcon,
  PlayIcon, StopIcon, DownloadIcon, CommitIcon,
  ReaderIcon
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
    refetchInterval: task && !task.deployment_completed ? 2000 : false, // Poll every 2 seconds only if not completed
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
      className="container mx-auto px-6 py-8"
    >
      {/* Breadcrumb */}
      <nav className="flex items-center space-x-2 text-sm font-mono mb-6">
        <Link href="/" className="text-muted-foreground hover:text-cyan-500 transition-colors">
          ~/projects
        </Link>
        <span className="text-muted-foreground">/</span>
        <Link href={`/p/${projectId}`} className="text-muted-foreground hover:text-cyan-500 transition-colors">
          {projectSlug}
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="text-cyan-500">tasks/{taskSlug}</span>
      </nav>

      {/* Modern GitHub Actions-style Header */}
      <div className="bg-card rounded-lg border border-border mb-6 overflow-hidden">
        <div className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-semibold">{task.name}</h1>
                {task.deployment_status === 'completed' ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-500 border border-green-500/20">
                    <CheckCircledIcon className="h-3 w-3 mr-1" />
                    Success
                  </span>
                ) : task.deployment_status === 'failed' ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-500 border border-red-500/20">
                    <CrossCircledIcon className="h-3 w-3 mr-1" />
                    Failed
                  </span>
                ) : task.deployment_status === 'deploying' || task.deployment_status === 'initializing' ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">
                    <DotFilledIcon className="h-3 w-3 mr-1 animate-pulse" />
                    In progress
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-500/10 text-gray-500 border border-gray-500/20">
                    <ClockIcon className="h-3 w-3 mr-1" />
                    Queued
                  </span>
                )}
              </div>
              
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <CommitIcon className="h-4 w-4" />
                  <span className="font-mono">{task.id.slice(0, 7)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <ClockIcon className="h-4 w-4" />
                  <span>
                    Created {new Date(task.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
                {task.deployment_completed_at && (
                  <div className="flex items-center gap-1">
                    <CheckCircledIcon className="h-4 w-4" />
                    <span>
                      Completed in {formatDuration(
                        new Date(task.deployment_started_at || task.created_at),
                        new Date(task.deployment_completed_at)
                      )}
                    </span>
                  </div>
                )}
              </div>
              
              {/* MCP Servers */}
              {task.mcp_servers && task.mcp_servers.length > 0 && (
                <div className="flex items-center gap-2 mt-3">
                  <span className="text-xs text-muted-foreground">MCP Servers:</span>
                  <div className="flex items-center gap-2">
                    {task.mcp_servers.map((server: any) => (
                      <span
                        key={server.server_type}
                        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-500/10 text-blue-500 border border-blue-500/20"
                      >
                        {server.server_type}
                        {server.access_token && <LockClosedIcon className="h-3 w-3 ml-1" />}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            {/* Actions */}
            <div className="flex items-center gap-2">
              {task.deployment_status === 'failed' && (
                <Button
                  onClick={() => api.retryTaskDeployment(taskId).then(() => refetchTask())}
                  size="sm"
                  variant="outline"
                  className="text-xs"
                >
                  <ReloadIcon className="h-3 w-3 mr-1" />
                  Re-run
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                className="text-xs"
                disabled
              >
                <DownloadIcon className="h-3 w-3 mr-1" />
                Download logs
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Modern Tab Navigation */}
      <div className="border-b border-border mb-6">
        <div className="flex space-x-8">
          {[
            { id: 'deployment', label: 'Summary', icon: <ActivityLogIcon className="h-4 w-4" /> },
            { id: 'chat', label: 'Chat', icon: <ChatBubbleIcon className="h-4 w-4" /> },
            { id: 'knowledge-base', label: 'Knowledge Base', icon: <ReaderIcon className="h-4 w-4" /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 pb-3 text-sm font-medium border-b-2 transition-all ${
                activeTab === tab.id
                  ? 'border-foreground text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
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
              {/* Run Summary */}
              <div className="bg-card rounded-lg border border-border p-4">
                <h3 className="text-sm font-medium mb-3">Run Summary</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Status</span>
                    <span className={`font-medium ${
                      task.deployment_status === 'completed' ? 'text-green-500' :
                      task.deployment_status === 'failed' ? 'text-red-500' :
                      task.deployment_status === 'deploying' ? 'text-yellow-500' :
                      'text-gray-500'
                    }`}>
                      {task.deployment_status.charAt(0).toUpperCase() + task.deployment_status.slice(1)}
                    </span>
                  </div>
                  
                  {task.deployment_started_at && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Started</span>
                      <span className="font-mono text-xs">
                        {new Date(task.deployment_started_at).toLocaleTimeString()}
                      </span>
                    </div>
                  )}
                  
                  {task.deployment_completed_at && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Duration</span>
                      <span className="font-mono text-xs">
                        {formatDuration(
                          new Date(task.deployment_started_at || task.created_at),
                          new Date(task.deployment_completed_at)
                        )}
                      </span>
                    </div>
                  )}
                  
                  {deploymentData && (
                    <>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Total Events</span>
                        <span className="font-mono text-xs">{deploymentData.hooks.length}</span>
                      </div>
                      
                      {/* Calculate total cost if available */}
                      {(() => {
                        const totalCost = deploymentData.hooks.reduce((sum, hook) => 
                          sum + (hook.data?.total_cost_usd || 0), 0
                        )
                        return totalCost > 0 ? (
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">Total Cost</span>
                            <span className="font-mono text-xs text-green-500">
                              ${totalCost.toFixed(4)}
                            </span>
                          </div>
                        ) : null
                      })()}
                    </>
                  )}
                </div>
              </div>
              
              {/* Artifacts */}
              <div className="bg-card rounded-lg border border-border p-4">
                <h3 className="text-sm font-medium mb-3">Artifacts</h3>
                <div className="space-y-2">
                  <button className="w-full text-left px-3 py-2 rounded hover:bg-muted/50 transition-colors text-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileIcon className="h-4 w-4 text-muted-foreground" />
                        <span>deployment-logs.txt</span>
                      </div>
                      <DownloadIcon className="h-3 w-3 text-muted-foreground" />
                    </div>
                  </button>
                </div>
              </div>
              
              {/* Repository Info */}
              {project && (
                <div className="bg-card rounded-lg border border-border p-4">
                  <h3 className="text-sm font-medium mb-3">Repository</h3>
                  <div className="space-y-2">
                    <a
                      href={getGitHubUrl(project.repo_url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-blue-500 hover:underline"
                    >
                      <CommitIcon className="h-4 w-4" />
                      <span className="truncate">{(() => {
                        const gitInfo = parseGitUrl(project.repo_url)
                        return gitInfo ? `${gitInfo.owner}/${gitInfo.repo}` : project.repo_url
                      })()}</span>
                    </a>
                  </div>
                </div>
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