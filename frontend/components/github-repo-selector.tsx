'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  GitHubLogoIcon,
  RocketIcon,
  ReloadIcon,
  StarIcon,
  CodeIcon,
  LockClosedIcon,
  LockOpen1Icon,
  CheckCircledIcon,
  MagnifyingGlassIcon
} from '@radix-ui/react-icons'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'
import { Input } from './ui/input'
import { Button } from './ui/button'
import { motion } from 'framer-motion'
import { fetchGitHubRepositories, initializeRepository, type GitHubRepository } from '@/lib/api/github-repositories'

interface GitHubRepoSelectorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function GitHubRepoSelector({ open, onOpenChange }: GitHubRepoSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepository | null>(null)
  const [taskName, setTaskName] = useState('')
  const queryClient = useQueryClient()

  // Fetch repositories (authenticated via X-User-ID header)
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['github-repositories'],
    queryFn: () => fetchGitHubRepositories({ per_page: 100 }),
    enabled: open,
  })

  // Initialize repository mutation
  const initializeMutation = useMutation({
    mutationFn: ({ github_repo_id, task_name }: { github_repo_id: number; task_name: string }) =>
      initializeRepository({
        github_repo_id,
        project_name: selectedRepo?.name,
        task_name
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      queryClient.invalidateQueries({ queryKey: ['github-repositories'] })
      onOpenChange(false)
      setSelectedRepo(null)
      setSearchQuery('')
      setTaskName('')

      // Redirect to the task page
      if (data.task_id && data.project_id) {
        window.location.href = `/p/${data.project_id}/t/${data.task_id}`
      }
    },
  })

  // Filter repositories based on search (show all repos, including initialized ones)
  const filteredRepos = data?.repositories.filter(repo =>
    (
      repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      repo.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      repo.description?.toLowerCase().includes(searchQuery.toLowerCase())
    )
  ) || []

  const handleInitialize = () => {
    if (selectedRepo && taskName.trim()) {
      initializeMutation.mutate({
        github_repo_id: selectedRepo.id, // This is GitHub repo ID (number)
        task_name: taskName.trim()
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] terminal-bg border-cyan-500/50 flex flex-col p-0">
        {/* Terminal header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card/50 flex-shrink-0">
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
            </div>
            <span className="text-xs font-mono text-muted-foreground">github-repo-selector</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
            className="font-mono text-xs hover:text-cyan-500"
          >
            <ReloadIcon className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="ml-2">Sync</span>
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          <div className="p-4 sm:p-6 flex-shrink-0">
            <DialogHeader>
              <DialogTitle className="text-2xl font-mono flex items-center space-x-2">
                <GitHubLogoIcon className="h-6 w-6 text-cyan-500" />
                <span>Select Repository</span>
              </DialogTitle>
              <DialogDescription className="font-mono text-sm text-muted-foreground">
                # Choose a GitHub repository and create a new task
              </DialogDescription>
            </DialogHeader>

            {/* Search */}
            <div className="mt-4 relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search repositories..."
                className="pl-10 bg-card/50 border-muted-foreground/30 focus:border-cyan-500 font-mono"
              />
            </div>

            {/* Stats */}
            <div className="mt-3 flex items-center justify-between text-xs font-mono text-muted-foreground">
              <span>
                {filteredRepos.length} {filteredRepos.length === 1 ? 'repository' : 'repositories'} found
              </span>
              {data && data.total > 0 && (
                <span className="flex items-center gap-2">
                  <span className="text-green-400">{data.repositories.filter(r => r.is_initialized).length} initialized</span>
                  <span>•</span>
                  <span>{data.repositories.filter(r => !r.is_initialized).length} new</span>
                </span>
              )}
            </div>
          </div>

          {/* Repository list */}
          <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center space-y-4">
                  <ReloadIcon className="h-8 w-8 animate-spin text-cyan-500 mx-auto" />
                  <p className="text-sm font-mono text-muted-foreground">Fetching repositories from GitHub...</p>
                </div>
              </div>
            ) : error ? (
              <div className="py-12 text-center space-y-4">
                <p className="text-red-400 font-mono text-sm">Failed to load repositories</p>
                <Button onClick={() => refetch()} variant="outline" className="font-mono">
                  <ReloadIcon className="mr-2 h-4 w-4" />
                  Retry
                </Button>
              </div>
            ) : filteredRepos.length === 0 ? (
              <div className="py-12 text-center space-y-4">
                <GitHubLogoIcon className="h-12 w-12 text-muted-foreground mx-auto opacity-50" />
                <div>
                  <p className="text-muted-foreground font-mono text-sm">
                    {searchQuery ? 'No repositories match your search' : 'No repositories available'}
                  </p>
                  {!searchQuery && (
                    <p className="text-xs text-muted-foreground mt-2 font-mono">
                      All your repositories have been initialized or you don't have any repositories yet.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-2 pb-4">
                {filteredRepos.map((repo) => (
                  <motion.button
                    key={repo.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    onClick={() => setSelectedRepo(repo)}
                    className={`w-full text-left p-4 rounded-lg border transition-all ${
                      selectedRepo?.id === repo.id
                        ? 'border-cyan-500 bg-cyan-500/10'
                        : 'border-border hover:border-cyan-500/50 hover:bg-card/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="font-mono font-semibold text-cyan-400 truncate">
                            {repo.full_name}
                          </h3>
                          {repo.is_private ? (
                            <LockClosedIcon className="h-3 w-3 text-yellow-500 flex-shrink-0" />
                          ) : (
                            <LockOpen1Icon className="h-3 w-3 text-green-500 flex-shrink-0" />
                          )}
                          {repo.is_fork && (
                            <span className="text-xs text-muted-foreground font-mono">fork</span>
                          )}
                          {repo.is_initialized && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-500/20 text-green-400 border border-green-500/50">
                              initialized
                            </span>
                          )}
                        </div>
                        {repo.description && (
                          <p className="text-xs text-muted-foreground font-mono mb-2 line-clamp-2">
                            {repo.description}
                          </p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-muted-foreground font-mono flex-wrap">
                          {repo.language && (
                            <span className="flex items-center gap-1">
                              <CodeIcon className="h-3 w-3" />
                              {repo.language}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <StarIcon className="h-3 w-3" />
                            {repo.stars_count}
                          </span>
                          {repo.topics && repo.topics.length > 0 && (
                            <div className="flex gap-1">
                              {repo.topics.slice(0, 3).map(topic => (
                                <span key={topic} className="px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400">
                                  {topic}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      {selectedRepo?.id === repo.id && (
                        <CheckCircledIcon className="h-5 w-5 text-cyan-500 flex-shrink-0" />
                      )}
                    </div>
                  </motion.button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border bg-card/50 p-4 sm:p-6 flex-shrink-0 space-y-4">
          {/* Task Name Input */}
          {selectedRepo && (
            <div className="space-y-2">
              <label htmlFor="task-name" className="text-xs font-mono text-muted-foreground">
                Task Name <span className="text-red-400">*</span>
              </label>
              <Input
                id="task-name"
                value={taskName}
                onChange={(e) => setTaskName(e.target.value)}
                placeholder="e.g., Setup, Development, Feature-Auth"
                className="bg-card/50 border-muted-foreground/30 focus:border-cyan-500 font-mono"
                disabled={initializeMutation.isPending}
              />
              <p className="text-xs font-mono text-muted-foreground">
                Selected: <span className="text-cyan-400">{selectedRepo.full_name}</span>
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onOpenChange(false)
                setSelectedRepo(null)
                setTaskName('')
              }}
              className="font-mono hover:border-red-500/50 hover:text-red-500"
            >
              ^C Cancel
            </Button>
            <Button
              onClick={handleInitialize}
              disabled={!selectedRepo || !taskName.trim() || initializeMutation.isPending}
              className="bg-cyan-500 hover:bg-cyan-600 text-black font-mono hover:glow-cyan transition-all"
            >
              {initializeMutation.isPending ? (
                <span className="flex items-center">
                  <ReloadIcon className="animate-spin h-4 w-4 mr-2" />
                  Creating Task...
                </span>
              ) : (
                <span className="flex items-center">
                  <RocketIcon className="mr-2 h-4 w-4" />
                  Create Task
                </span>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
