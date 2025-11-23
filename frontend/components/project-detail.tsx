'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { GitHubLogoIcon, RocketIcon, CodeIcon, ActivityLogIcon, FileTextIcon, LockClosedIcon } from '@radix-ui/react-icons'
import { motion } from 'framer-motion'
import { api } from '@/lib/api'
import { parseGitUrl, getGitHubUrl } from '@/lib/git-url-parser'
import { TaskList } from './task-list'
import { GitHubIssuesList } from './github-issues-list'
import { Skeleton } from './ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip'

interface ProjectDetailProps {
  projectId: string
}

export function ProjectDetail({ projectId }: ProjectDetailProps) {
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        const profile = await api.getMyProfile()
        setIsAdmin(profile.is_admin || false)
      } catch (error) {
        console.error('Failed to check admin status:', error)
        setIsAdmin(false)
      }
    }

    const storedUser = localStorage.getItem('github_user')
    if (storedUser) {
      checkAdminStatus()
    }
  }, [])

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => api.getProject(projectId),
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
          {isAdmin ? (
            <TabsTrigger
              value="issues"
              className="font-mono data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400"
            >
              <FileTextIcon className="h-4 w-4 mr-2" />
              Issues
            </TabsTrigger>
          ) : (
            <div
              className="relative group inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all cursor-not-allowed opacity-60 hover:opacity-80"
              title="Coming Soon"
            >
              <LockClosedIcon className="h-3 w-3 mr-2 text-muted-foreground" />
              <span className="font-mono text-muted-foreground">Issues</span>
              <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 px-2 py-1 bg-card border border-purple-500/50 rounded text-xs font-mono text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                Coming Soon
              </span>
            </div>
          )}
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

        {isAdmin && (
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
        )}
      </Tabs>
    </motion.div>
  )
}