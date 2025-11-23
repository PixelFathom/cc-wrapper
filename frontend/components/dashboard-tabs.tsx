'use client'

import { useState, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ProjectList } from './project-list'
import { GitHubIssuesExplorer } from './github-issues-explorer'
import { api } from '@/lib/api'
import { LockClosedIcon } from '@radix-ui/react-icons'

export function DashboardTabs() {
  const [activeTab, setActiveTab] = useState('projects')
  const [isAdmin, setIsAdmin] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        const profile = await api.getMyProfile()
        setIsAdmin(profile.is_admin || false)
      } catch (error) {
        console.error('Failed to check admin status:', error)
        setIsAdmin(false)
      } finally {
        setIsLoading(false)
      }
    }

    const storedUser = localStorage.getItem('github_user')
    if (storedUser) {
      setIsLoggedIn(true)
      checkAdminStatus()
    } else {
      setIsLoggedIn(false)
      setIsLoading(false)
    }
  }, [])

  const handleTabChange = (value: string) => {
    // Prevent switching to issues tab if not admin
    if (value === 'issues' && !isAdmin) {
      return
    }
    setActiveTab(value)
  }

  return (
    <section className="container mx-auto px-6 py-16">
      {isLoggedIn ? (
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          {/* Tab Headers */}
          <div className="mb-8">
            <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 bg-card/50 border border-border">
              <TabsTrigger
                value="projects"
                className="font-mono data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400"
              >
                <span className="text-muted-foreground mr-2">{'<'}</span>
                Projects
                <span className="text-muted-foreground ml-2">{'/>'}</span>
              </TabsTrigger>
              {isAdmin ? (
                <TabsTrigger
                  value="issues"
                  className="font-mono data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-400"
                >
                  <span className="text-muted-foreground mr-2">{'<'}</span>
                  GitHub Issues
                  <span className="text-muted-foreground ml-2">{'/>'}</span>
                </TabsTrigger>
              ) : (
                <div
                  className="relative group inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all cursor-not-allowed opacity-60 hover:opacity-80"
                  title="Coming Soon"
                >
                  <LockClosedIcon className="h-3 w-3 mr-2 text-muted-foreground" />
                  <span className="font-mono text-muted-foreground">
                    <span className="mr-1">{'<'}</span>
                    Issues
                    <span className="ml-1">{'/>'}</span>
                  </span>
                  <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 px-2 py-1 bg-card border border-purple-500/50 rounded text-xs font-mono text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                    Coming Soon
                  </span>
                </div>
              )}
            </TabsList>
          </div>

          {/* Projects Tab */}
          <TabsContent value="projects" className="mt-0">
            <div className="mb-12">
              <div className="max-w-4xl mx-auto">
                <div className="terminal-bg rounded-lg border border-border p-6 mb-8">
                  <div className="font-mono">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="text-green-400">➜</span>
                      <span className="text-cyan-500">ls</span>
                      <span className="text-muted-foreground">-la</span>
                      <span className="text-purple-400">~/projects</span>
                    </div>
                    <div className="text-muted-foreground text-sm">
                      <span>total {Math.floor(Math.random() * 100) + 20}</span>
                      <br />
                      <span>drwxr-xr-x  12 dev  staff  384 {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
                      <span className="text-cyan-500 ml-1">.</span>
                    </div>
                  </div>
                </div>
                <div className="text-center mb-8">
                  <h2 className="text-3xl font-bold font-mono mb-2">
                    <span className="text-muted-foreground">{'<'}</span>
                    <span className="text-cyan-500">Active</span>
                    <span className="text-purple-400">Repositories</span>
                    <span className="text-muted-foreground">{' />'}</span>
                  </h2>
                  <p className="text-muted-foreground font-mono text-sm">
                    // Track your code projects with git-powered workflows
                  </p>
                </div>
              </div>
            </div>
            <ProjectList />
          </TabsContent>

          {/* GitHub Issues Tab - Admin Only */}
          {isAdmin && (
            <TabsContent value="issues" className="mt-0">
              <GitHubIssuesExplorer />
            </TabsContent>
          )}
        </Tabs>
      ) : (
        <div className="text-center py-16">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-3xl font-bold font-mono mb-4">
              <span className="text-muted-foreground">{'<'}</span>
              <span className="text-cyan-500">Welcome</span>
              <span className="text-muted-foreground">{' />'}</span>
            </h2>
            <p className="text-muted-foreground font-mono text-lg mb-8">
              // Please sign in with GitHub to access your projects
            </p>
            <div className="terminal-bg rounded-lg border border-border p-6 mb-6">
              <div className="font-mono text-sm text-muted-foreground">
                <span className="text-green-400">➜</span>
                <span className="text-cyan-500 ml-2">auth</span>
                <span className="ml-2">--provider github</span>
                <br />
                <span className="text-purple-400 mt-2 inline-block">Authentication required to continue...</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
