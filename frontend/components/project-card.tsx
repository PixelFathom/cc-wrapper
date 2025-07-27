'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { GitHubLogoIcon, RocketIcon, CodeIcon, CheckCircledIcon, Cross2Icon } from '@radix-ui/react-icons'
import { Project } from '@/lib/api'
import { parseGitUrl } from '@/lib/git-url-parser'

interface ProjectCardProps {
  project: Project
  index: number
}

export function ProjectCard({ project, index }: ProjectCardProps) {
  const gitInfo = parseGitUrl(project.repo_url)
  const repoOwner = gitInfo?.owner || 'unknown'
  const repoName = gitInfo?.repo || 'repository'
  const createdDate = new Date(project.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })

  // Show project as active if it has tasks
  const taskCount = project.tasks?.length || 0
  const completedTasks = project.tasks?.filter(t => t.deployment_completed).length || 0
  const isActive = taskCount > 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      whileHover={{ y: -2 }}
      className="group h-full"
      data-testid="project-card"
    >
      <Link href={`/p/${project.id}`}>
        <div className="relative h-full gradient-border-neon rounded-lg overflow-hidden hover:glow-cyan transition-all duration-300">
          {/* Terminal header */}
          <div className="bg-card/80 border-b border-border px-3 sm:px-4 py-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 min-w-0">
                <div className="flex items-center space-x-1 sm:space-x-1.5 shrink-0">
                  <div className="w-2 sm:w-2.5 h-2 sm:h-2.5 rounded-full bg-red-500"></div>
                  <div className="w-2 sm:w-2.5 h-2 sm:h-2.5 rounded-full bg-yellow-500"></div>
                  <div className="w-2 sm:w-2.5 h-2 sm:h-2.5 rounded-full bg-green-500"></div>
                </div>
                <span className="text-xs font-mono text-muted-foreground truncate">~/projects/{project.name.toLowerCase().replace(/\s+/g, '-')}</span>
              </div>
              <div className="flex items-center space-x-2 shrink-0">
                {isActive && (
                  <span className="flex items-center space-x-1">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                    <span className="text-xs text-green-500 font-mono hidden sm:inline">active</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Terminal content */}
          <div className="bg-card/50 p-3 sm:p-4 font-mono text-xs sm:text-sm min-h-[140px] sm:min-h-[120px]">
            {/* Project name as a command */}
            <div className="mb-2 sm:mb-3">
              <span className="text-green-400">➜</span>
              <span className="text-cyan-500 ml-1 sm:ml-2">project</span>
              <span className="text-muted-foreground ml-1 sm:ml-2 hidden sm:inline">info</span>
              <span className="text-purple-400 ml-1 sm:ml-2 truncate">{project.name}</span>
            </div>

            {/* Git info */}
            <div className="mb-2 text-xs">
              <span className="text-muted-foreground">origin</span>
              <span className="text-cyan-500 ml-1 sm:ml-2 hidden sm:inline">git@github.com:</span>
              <span className="text-yellow-500 sm:hidden">...</span>
              <span className="text-yellow-500 hidden sm:inline">{repoOwner}/</span>
              <span className="text-green-400 hidden sm:inline">{repoName}</span>
              <span className="text-muted-foreground ml-1 sm:ml-2 hidden sm:inline">(fetch)</span>
            </div>

            {/* Status */}
            <div className="mb-2 sm:mb-3 text-xs">
              <span className="text-muted-foreground">branch</span>
              <span className="text-red-400 ml-1 sm:ml-2">main</span>
              <span className="text-muted-foreground ml-1 sm:ml-2">•</span>
              <span className="text-green-400 ml-1 sm:ml-2">↑{completedTasks}</span>
              <span className="text-muted-foreground ml-1">/</span>
              <span className="text-yellow-400 ml-1">{taskCount}</span>
              <span className="text-yellow-400 ml-1 hidden sm:inline">tasks</span>
            </div>

            {/* Last command - hidden on mobile */}
            <div className="text-xs opacity-0 group-hover:opacity-100 transition-opacity duration-300 hidden sm:block">
              <span className="text-muted-foreground">$</span>
              <span className="text-cyan-500 ml-2">cd</span>
              <span className="text-muted-foreground ml-2">{project.name.toLowerCase().replace(/\s+/g, '-')}</span>
              <span className="animate-terminal-cursor ml-1">_</span>
            </div>
          </div>

          {/* Bottom status bar */}
          <div className="absolute bottom-0 left-0 right-0 bg-black/20 border-t border-border/50 px-3 sm:px-4 py-1 flex items-center justify-between text-xs font-mono">
            <div className="flex items-center space-x-2 sm:space-x-3">
              <span className="text-muted-foreground hidden sm:inline">created:</span>
              <span className="text-green-400">{createdDate}</span>
            </div>
            <div className="flex items-center space-x-2">
              <RocketIcon className="h-3 w-3 text-cyan-500" />
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}