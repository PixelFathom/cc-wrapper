'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  GitHubLogoIcon,
  RocketIcon,
  ReloadIcon,
  ExclamationTriangleIcon,
  CheckCircledIcon,
  ChatBubbleIcon,
  CalendarIcon,
  PersonIcon,
  MagnifyingGlassIcon,
} from '@radix-ui/react-icons'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Badge } from './ui/badge'
import { motion } from 'framer-motion'
import { fetchGitHubRepositories, type GitHubRepository } from '@/lib/api/github-repositories'
import { solveGitHubIssue } from '@/lib/api/issue-resolution'
import { api } from '@/lib/api'
import { useRouter } from 'next/navigation'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select'

interface GitHubIssue {
  number: number
  title: string
  body: string | null
  state: string
  labels: Array<{ name: string; color: string }>
  html_url: string
  user: { login: string }
  created_at: string
  updated_at: string
  comments: number
}

export function GitHubIssuesBrowser() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepository | null>(null)
  const [stateFilter, setStateFilter] = useState<'open' | 'closed' | 'all'>('open')
  const [issues, setIssues] = useState<GitHubIssue[]>([])
  const [loadingIssues, setLoadingIssues] = useState(false)
  const queryClient = useQueryClient()
  const router = useRouter()

  // Fetch repositories
  const { data: reposData, isLoading: loadingRepos, error: reposError, refetch: refetchRepos } = useQuery({
    queryKey: ['github-repositories'],
    queryFn: () => fetchGitHubRepositories({ per_page: 100 }),
  })

  // Fetch issues for selected repo via backend API
  const fetchIssues = async (repo: GitHubRepository) => {
    setLoadingIssues(true)
    try {
      const storedUser = localStorage.getItem('github_user')
      if (!storedUser) throw new Error('Not authenticated')

      const user = JSON.parse(storedUser)

      // Note: We'll need to create a project first or find an existing one to fetch issues
      // For now, let's call GitHub API directly (backend doesn't have a generic issues endpoint)
      // The backend issue endpoints require a project_id

      // This is a temporary direct call - in production you'd want a backend endpoint
      const response = await fetch(
        `https://api.github.com/repos/${repo.owner}/${repo.name}/issues?state=${stateFilter}&per_page=50`,
        {
          headers: {
            'Accept': 'application/vnd.github.v3+json',
          },
        }
      )

      if (!response.ok) throw new Error('Failed to fetch issues')

      const data = await response.json()
      // Filter out pull requests (they appear in issues API)
      const issuesOnly = data.filter((issue: any) => !issue.pull_request)
      setIssues(issuesOnly)
    } catch (error) {
      console.error('Failed to fetch issues:', error)
      setIssues([])
    } finally {
      setLoadingIssues(false)
    }
  }

  // Solve issue mutation
  const solveMutation = useMutation({
    mutationFn: async ({ owner, repo, issueNumber, repoUrl, issueTitle, issueBody }: {
      owner: string;
      repo: string;
      issueNumber: number;
      repoUrl: string;
      issueTitle: string;
      issueBody: string;
    }) => {
      // Step 1: Check if project already exists for this repo
      const projects = await api.getProjects()
      let project = projects.find(p =>
        p.repo_url.includes(`${owner}/${repo}`) ||
        p.name === repo
      )

      // Step 2: Create project if it doesn't exist
      if (!project) {
        project = await api.createProject({
          name: repo,
          repo_url: repoUrl
        })
      }

      // Step 3: Solve the issue using the project_id
      return solveGitHubIssue(project.id, issueNumber, {
        issue_title: issueTitle,
        issue_body: issueBody
      })
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['github-repositories'] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      // Redirect to task page
      router.push(`/p/${data.project_id}/t/${data.task_id}`)
    },
  })

  // Filter repositories based on search
  const filteredRepos = reposData?.repositories.filter(repo =>
    repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    repo.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    repo.description?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || []

  const handleRepoSelect = (repo: GitHubRepository) => {
    setSelectedRepo(repo)
    fetchIssues(repo)
  }

  const handleSolveIssue = (issueNumber: number, issueTitle: string, issueBody: string) => {
    if (!selectedRepo) return
    if (confirm(`Create resolution task for issue #${issueNumber}: ${issueTitle}?`)) {
      solveMutation.mutate({
        owner: selectedRepo.owner,
        repo: selectedRepo.name,
        issueNumber,
        repoUrl: selectedRepo.clone_url || `https://github.com/${selectedRepo.owner}/${selectedRepo.name}.git`,
        issueTitle,
        issueBody
      })
    }
  }

  const getStateColor = (state: string) => {
    switch (state) {
      case 'open':
        return 'text-green-400 border-green-500/50 bg-green-500/10'
      case 'closed':
        return 'text-purple-400 border-purple-500/50 bg-purple-500/10'
      default:
        return 'text-gray-400 border-gray-500/50 bg-gray-500/10'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <GitHubLogoIcon className="h-6 w-6 text-cyan-500" />
          <h2 className="text-xl font-mono font-semibold">Browse GitHub Issues</h2>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetchRepos()}
          disabled={loadingRepos}
          className="font-mono text-xs hover:text-cyan-500"
        >
          <ReloadIcon className={`h-4 w-4 mr-2 ${loadingRepos ? 'animate-spin' : ''}`} />
          Sync
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Repositories Panel */}
        <div className="lg:col-span-1 space-y-4">
          <div className="rounded-lg border border-border bg-card/50 p-4">
            <h3 className="text-sm font-mono font-semibold mb-3 flex items-center gap-2">
              <GitHubLogoIcon className="h-4 w-4 text-cyan-500" />
              Your Repositories
            </h3>

            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search repos..."
              className="mb-3 bg-card/50 border-muted-foreground/30 focus:border-cyan-500 font-mono text-sm"
            />

            <div className="text-xs font-mono text-muted-foreground mb-3">
              {filteredRepos.length} {filteredRepos.length === 1 ? 'repo' : 'repos'}
            </div>

            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {loadingRepos ? (
                <div className="text-center py-8">
                  <ReloadIcon className="h-6 w-6 animate-spin text-cyan-500 mx-auto" />
                </div>
              ) : reposError ? (
                <div className="text-center py-8 text-red-400 text-xs">
                  Failed to load repositories
                </div>
              ) : filteredRepos.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-xs">
                  No repositories found
                </div>
              ) : (
                filteredRepos.map((repo) => (
                  <button
                    key={repo.id}
                    onClick={() => handleRepoSelect(repo)}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                      selectedRepo?.id === repo.id
                        ? 'border-cyan-500 bg-cyan-500/10'
                        : 'border-border hover:border-cyan-500/50 hover:bg-card/50'
                    }`}
                  >
                    <div className="font-mono text-sm font-semibold text-cyan-400 mb-1 truncate">
                      {repo.name}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {repo.language && (
                        <span className="text-xs">{repo.language}</span>
                      )}
                      {repo.open_issues_count > 0 && (
                        <Badge variant="outline" className="text-xs bg-green-500/10 text-green-400 border-green-500/50">
                          {repo.open_issues_count} issues
                        </Badge>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Issues Panel */}
        <div className="lg:col-span-2 space-y-4">
          {!selectedRepo ? (
            <div className="rounded-lg border border-border bg-card/50 p-12 text-center">
              <GitHubLogoIcon className="h-12 w-12 text-muted-foreground mx-auto opacity-50 mb-4" />
              <p className="text-muted-foreground font-mono text-sm">
                Select a repository to view its issues
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-card/50 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-mono font-semibold flex items-center gap-2">
                    Issues: {selectedRepo.full_name}
                  </h3>
                  <Select value={stateFilter} onValueChange={(value: any) => {
                    setStateFilter(value)
                    fetchIssues(selectedRepo)
                  }}>
                    <SelectTrigger className="w-[120px] h-8 font-mono bg-card/50 border-muted-foreground/30 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                      <SelectItem value="all">All</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="text-xs font-mono text-muted-foreground">
                  {issues.length} {issues.length === 1 ? 'issue' : 'issues'}
                </div>
              </div>

              <div className="space-y-3">
                {loadingIssues ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="text-center space-y-4">
                      <ReloadIcon className="h-8 w-8 animate-spin text-cyan-500 mx-auto" />
                      <p className="text-sm font-mono text-muted-foreground">Loading issues...</p>
                    </div>
                  </div>
                ) : issues.length === 0 ? (
                  <div className="py-12 text-center space-y-4">
                    <CheckCircledIcon className="h-12 w-12 text-green-400 mx-auto opacity-50" />
                    <p className="text-muted-foreground font-mono text-sm">
                      No {stateFilter} issues
                    </p>
                  </div>
                ) : (
                  issues.map((issue) => (
                    <motion.div
                      key={issue.number}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 rounded-lg border border-border bg-card/50 hover:border-cyan-500/50 transition-all"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex items-start gap-3">
                            <span className="text-xs font-mono text-muted-foreground mt-1">
                              #{issue.number}
                            </span>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-mono font-semibold text-cyan-400 mb-2 break-words">
                                {issue.title}
                              </h3>
                              {issue.body && (
                                <p className="text-xs text-muted-foreground font-mono line-clamp-2 mb-2">
                                  {issue.body}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-4 text-xs text-muted-foreground font-mono flex-wrap">
                            <Badge variant="outline" className={getStateColor(issue.state)}>
                              {issue.state}
                            </Badge>

                            <span className="flex items-center gap-1">
                              <PersonIcon className="h-3 w-3" />
                              {issue.user.login}
                            </span>

                            <span className="flex items-center gap-1">
                              <ChatBubbleIcon className="h-3 w-3" />
                              {issue.comments}
                            </span>

                            <span className="flex items-center gap-1">
                              <CalendarIcon className="h-3 w-3" />
                              {new Date(issue.updated_at).toLocaleDateString()}
                            </span>
                          </div>

                          {issue.labels && issue.labels.length > 0 && (
                            <div className="flex gap-2 flex-wrap">
                              {issue.labels.slice(0, 5).map((label: any) => (
                                <Badge
                                  key={label.name}
                                  variant="outline"
                                  className="text-xs bg-cyan-500/10 text-cyan-400 border-cyan-500/50"
                                >
                                  {label.name}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {issue.state === 'open' ? (
                            <Button
                              size="sm"
                              onClick={() => handleSolveIssue(issue.number, issue.title, issue.body || '')}
                              disabled={solveMutation.isPending}
                              className="bg-cyan-500 hover:bg-cyan-600 text-black font-mono text-xs"
                            >
                              {solveMutation.isPending ? (
                                <>
                                  <ReloadIcon className="animate-spin h-3 w-3 mr-2" />
                                  Creating...
                                </>
                              ) : (
                                <>
                                  <RocketIcon className="mr-2 h-3 w-3" />
                                  Solve
                                </>
                              )}
                            </Button>
                          ) : (
                            <Badge variant="outline" className="text-purple-400">
                              Closed
                            </Badge>
                          )}

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => window.open(issue.html_url, '_blank')}
                            className="font-mono text-xs"
                          >
                            <GitHubLogoIcon className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
