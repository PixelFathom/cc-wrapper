'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ProjectList } from './project-list'
import { GitHubIssuesExplorer } from './github-issues-explorer'

export function DashboardTabs() {
  const [activeTab, setActiveTab] = useState('projects')

  return (
    <section className="container mx-auto px-6 py-16">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
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
            <TabsTrigger
              value="issues"
              className="font-mono data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-400"
            >
              <span className="text-muted-foreground mr-2">{'<'}</span>
              GitHub Issues
              <span className="text-muted-foreground ml-2">{'/>'}</span>
            </TabsTrigger>
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

        {/* GitHub Issues Tab */}
        <TabsContent value="issues" className="mt-0">
          <GitHubIssuesExplorer />
        </TabsContent>
      </Tabs>
    </section>
  )
}
