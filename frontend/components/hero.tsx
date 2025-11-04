'use client'

import { motion } from 'framer-motion'
import { ArrowRightIcon, RocketIcon, GitHubLogoIcon } from '@radix-ui/react-icons'
import { Button } from './ui/button'
import { useState, useEffect } from 'react'
import { CreateProjectDialog } from './create-project-dialog'
import { GitHubRepoSelector } from './github-repo-selector'
import { getGitHubAuthUrl } from '@/lib/api/github-auth'

export function Hero() {
  const [text, setText] = useState('')
  const fullText = "Build. Deploy. Collaborate."
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [repoSelectorOpen, setRepoSelectorOpen] = useState(false)
  const [githubLoading, setGithubLoading] = useState(false)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    let index = 0
    const timer = setInterval(() => {
      setText(fullText.slice(0, index))
      index++
      if (index > fullText.length) {
        clearInterval(timer)
      }
    }, 100)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    // Check if user is already authenticated
    const storedUser = localStorage.getItem('github_user')
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser))
      } catch (e) {
        console.error('Failed to parse stored user:', e)
      }
    }
  }, [])

  const handleGitHubLogin = async () => {
    setGithubLoading(true)
    try {
      const { authorization_url, state } = await getGitHubAuthUrl()
      sessionStorage.setItem('github_oauth_state', state)
      window.location.href = authorization_url
    } catch (error) {
      console.error('Failed to initiate GitHub login:', error)
      setGithubLoading(false)
    }
  }

  return (
    <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden px-4 sm:px-6">
      {/* Matrix-like background effect */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-500/5 to-transparent"></div>
        <div className="absolute top-1/4 -left-20 w-64 sm:w-96 h-64 sm:h-96 bg-cyan-500/20 rounded-full filter blur-3xl animate-pulse-slow"></div>
        <div className="absolute bottom-1/4 -right-20 w-64 sm:w-96 h-64 sm:h-96 bg-purple-600/20 rounded-full filter blur-3xl animate-pulse-slow" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="container mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center"
        >
          {/* Terminal window */}
          <div className="max-w-4xl mx-auto mb-8 sm:mb-12">
            <div className="terminal-bg rounded-lg border border-border overflow-hidden">
              <div className="flex items-center justify-between px-3 sm:px-4 py-2 border-b border-border bg-card/50">
                <div className="flex items-center space-x-1.5 sm:space-x-2">
                  <div className="w-2.5 sm:w-3 h-2.5 sm:h-3 rounded-full bg-red-500"></div>
                  <div className="w-2.5 sm:w-3 h-2.5 sm:h-3 rounded-full bg-yellow-500"></div>
                  <div className="w-2.5 sm:w-3 h-2.5 sm:h-3 rounded-full bg-green-500"></div>
                </div>
                <span className="text-xs font-mono text-muted-foreground">~/project-hub</span>
              </div>
              <div className="p-4 sm:p-6 font-mono text-sm sm:text-base">
                <div className="text-left">
                  <span className="text-green-400">➜</span>
                  <span className="text-cyan-500 ml-2">project-hub</span>
                  <span className="text-muted-foreground ml-2 hidden sm:inline">git:(</span>
                  <span className="text-red-400 hidden sm:inline">main</span>
                  <span className="text-muted-foreground hidden sm:inline">)</span>
                  <span className="ml-2 text-xs sm:text-base">npm run dev</span>
                </div>
                <div className="mt-4 text-left">
                  <div className="text-muted-foreground text-xs sm:text-sm">
                    <span className="text-green-400">✓</span> Starting development server...
                  </div>
                  <div className="text-muted-foreground mt-1 text-xs sm:text-sm">
                    <span className="text-green-400">✓</span> Ready on{' '}
                    <span className="text-cyan-500">http://localhost:3000</span>
                  </div>
                  <div className="mt-4">
                    <span className="text-xl sm:text-2xl md:text-4xl font-bold">
                      {text}
                      <span className="animate-terminal-cursor">|</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <p className="text-lg sm:text-xl md:text-2xl text-muted-foreground mb-8 max-w-3xl mx-auto">
            The developer-first project management platform. Write code, not status reports.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12 sm:mb-16">
            {user ? (
              <>
                <div className="relative group">
                  <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg blur opacity-25 group-hover:opacity-50 transition duration-300"></div>
                  <div className="relative flex items-center gap-3 terminal-bg rounded-lg px-4 py-3 border border-purple-500/30">
                    {user.avatar_url && (
                      <img
                        src={user.avatar_url}
                        alt={user.github_login}
                        className="w-8 h-8 rounded-full ring-2 ring-purple-500/50"
                      />
                    )}
                    <div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-mono text-muted-foreground">$</span>
                        <span className="text-xs font-mono text-purple-400">whoami</span>
                      </div>
                      <p className="text-sm font-mono text-cyan-400">@{user.github_login}</p>
                    </div>
                  </div>
                </div>
                <Button
                  size="lg"
                  className="bg-cyan-500 hover:bg-cyan-600 text-black font-medium rounded-lg hover:glow-cyan transition-all group font-mono"
                  onClick={() => setRepoSelectorOpen(true)}
                >
                  <RocketIcon className="mr-2 h-5 w-5" />
                  $ npm run build
                  <ArrowRightIcon className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </>
            ) : (
              <Button
                size="lg"
                className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-medium rounded-lg shadow-lg hover:shadow-purple-500/50 transition-all group"
                onClick={handleGitHubLogin}
                disabled={githubLoading}
              >
                {githubLoading ? (
                  <>
                    <span className="animate-spin mr-2">⚡</span>
                    <span className="font-mono">Connecting to GitHub...</span>
                  </>
                ) : (
                  <>
                    <GitHubLogoIcon className="mr-2 h-5 w-5" />
                    Sign in with GitHub
                    <ArrowRightIcon className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </Button>
            )}
          </div>

        </motion.div>
      </div>
      
      <GitHubRepoSelector
        open={repoSelectorOpen}
        onOpenChange={setRepoSelectorOpen}
      />

      <CreateProjectDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
    </section>
  )
}