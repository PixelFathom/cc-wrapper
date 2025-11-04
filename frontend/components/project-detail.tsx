'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronRightIcon, GitHubLogoIcon, RocketIcon, CodeIcon, ActivityLogIcon, FileTextIcon, TrashIcon } from '@radix-ui/react-icons'
import { motion } from 'framer-motion'
import { api } from '@/lib/api'
import { parseGitUrl, getGitHubUrl } from '@/lib/git-url-parser'
import { TaskList } from './task-list'
import { GitHubIssuesList } from './github-issues-list'
import { Button } from './ui/button'
import { Skeleton } from './ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { ConfirmationModal } from './ui/confirmation-modal'

interface ProjectDetailProps {
  projectId: string
}

export function ProjectDetail({ projectId }: ProjectDetailProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => api.getProject(projectId),
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteProject(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      router.push('/')
    },
    onError: (error) => {
      console.error('Failed to delete project:', error)
    },
  })

  if (isLoading) {
    return (
      <div className="container mx-auto px-6 py-8">
        <div className="terminal-bg rounded-lg border border-border p-6 mb-8">
          <Skeleton className="h-6 w-64 mb-4" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-32 gradient-border-neon rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="container mx-auto px-6 py-8">
        <div className="terminal-bg rounded-lg border border-border p-6">
          <div className="font-mono text-red-400">
            <span className="text-muted-foreground">$</span> Error: Project not found
          </div>
        </div>
      </div>
    )
  }

  const gitInfo = parseGitUrl(project.repo_url)
  const repoOwner = gitInfo?.owner || 'unknown'
  const repoName = gitInfo?.repo || 'repository'

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
        <span className="text-cyan-500">{project.name.toLowerCase().replace(/\s+/g, '-')}</span>
      </nav>

      {/* Project Header Terminal */}
      <div className="terminal-bg rounded-lg border border-border mb-8 overflow-hidden">
        {/* Terminal header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card/50">
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
            </div>
            <span className="text-xs font-mono text-muted-foreground">project-info</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            <span className="text-xs text-green-500 font-mono">connected</span>
          </div>
        </div>

        {/* Terminal content */}
        <div className="p-6 font-mono">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="mb-4">
              <span className="text-green-400">➜</span>
              <span className="text-cyan-500 ml-2">git</span>
              <span className="text-muted-foreground ml-2">remote -v</span>
            </div>
            
            <div className="ml-6 space-y-2">
              <div className="text-sm">
                <span className="text-muted-foreground">origin</span>
                <span className="text-cyan-500 ml-4">git@github.com:</span>
                <span className="text-yellow-500">{repoOwner}/</span>
                <span className="text-green-400">{repoName}</span>
                <span className="text-muted-foreground ml-2">(fetch)</span>
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">origin</span>
                <span className="text-cyan-500 ml-4">git@github.com:</span>
                <span className="text-yellow-500">{repoOwner}/</span>
                <span className="text-green-400">{repoName}</span>
                <span className="text-muted-foreground ml-2">(push)</span>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="mt-6"
          >
            <div className="mb-4">
              <span className="text-green-400">➜</span>
              <span className="text-cyan-500 ml-2">project</span>
              <span className="text-muted-foreground ml-2">status</span>
            </div>
            
            <div className="ml-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="code-block p-3">
                <div className="flex items-center space-x-2 mb-1">
                  <RocketIcon className="h-4 w-4 text-cyan-500" />
                  <span className="text-xs text-muted-foreground">Status</span>
                </div>
                <div className="text-green-400 font-semibold">Active</div>
              </div>
              
              <div className="code-block p-3">
                <div className="flex items-center space-x-2 mb-1">
                  <CodeIcon className="h-4 w-4 text-purple-400" />
                  <span className="text-xs text-muted-foreground">Tasks</span>
                </div>
                <div className="text-yellow-400 font-semibold">{project.tasks?.length || 0} items</div>
              </div>
              
              <div className="code-block p-3">
                <div className="flex items-center space-x-2 mb-1">
                  <ActivityLogIcon className="h-4 w-4 text-green-400" />
                  <span className="text-xs text-muted-foreground">Created</span>
                </div>
                <div className="text-cyan-500 font-semibold">
                  {new Date(project.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.2 }}
            className="mt-6 flex items-center space-x-4"
          >
            <a
              href={getGitHubUrl(project.repo_url)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-2 bg-card hover:bg-card/80 px-4 py-2 rounded-lg border border-border hover:border-cyan-500/50 transition-all group"
            >
              <GitHubLogoIcon className="h-4 w-4 text-muted-foreground group-hover:text-cyan-500" />
              <span className="text-sm font-mono group-hover:text-cyan-500">View on GitHub</span>
            </a>
            <Button
              variant="outline"
              onClick={() => setShowDeleteModal(true)}
              className="inline-flex items-center space-x-2 border-red-500/50 hover:border-red-500 hover:bg-red-500/10 text-red-400 hover:text-red-300"
            >
              <TrashIcon className="h-4 w-4" />
              <span className="text-sm font-mono">Delete Project</span>
            </Button>
          </motion.div>
        </div>
      </div>

      {/* Tabs for Tasks and Issues */}
      <Tabs defaultValue="tasks" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2 bg-card/50 border border-border">
          <TabsTrigger
            value="tasks"
            className="font-mono data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400"
          >
            <CodeIcon className="h-4 w-4 mr-2" />
            Tasks
          </TabsTrigger>
          <TabsTrigger
            value="issues"
            className="font-mono data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400"
          >
            <FileTextIcon className="h-4 w-4 mr-2" />
            Issues
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold font-mono">
              <span className="text-muted-foreground">$</span>
              <span className="text-cyan-500 ml-2">task</span>
              <span className="text-purple-400 ml-2">list</span>
            </h2>
          </div>

          <TaskList projectId={projectId} />
        </TabsContent>

        <TabsContent value="issues" className="space-y-6">
          {project.repo_url?.includes('github.com') ? (
            <GitHubIssuesList projectId={projectId} />
          ) : (
            <div className="terminal-bg rounded-lg border border-border p-8 text-center">
              <GitHubLogoIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <p className="text-muted-foreground font-mono text-sm">
                This project is not linked to a GitHub repository.
              </p>
              <p className="text-muted-foreground font-mono text-xs mt-2">
                Initialize a project from a GitHub repository to see issues.
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={async () => {
          await deleteMutation.mutateAsync()
          setShowDeleteModal(false)
        }}
        title="Delete Project"
        description={`Are you sure you want to delete "${project.name}"? This will permanently delete the project and all associated tasks. This action cannot be undone.`}
        confirmText="Delete Project"
        cancelText="Cancel"
        variant="danger"
        loading={deleteMutation.isPending}
      >
        <div className="p-3 bg-red-500/10 rounded-lg border border-red-500/30 mt-2">
          <div className="text-xs font-mono text-red-300">
            <div className="font-semibold mb-1">⚠️ Warning:</div>
            <ul className="list-disc list-inside space-y-1 text-red-300/80">
              <li>All tasks will be deleted</li>
              <li>All chat sessions will be lost</li>
              <li>All test cases will be removed</li>
              <li>This action is irreversible</li>
            </ul>
          </div>
        </div>
      </ConfirmationModal>
    </motion.div>
  )
}