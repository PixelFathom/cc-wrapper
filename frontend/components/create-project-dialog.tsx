'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { GitHubLogoIcon, RocketIcon, CheckCircledIcon, InfoCircledIcon } from '@radix-ui/react-icons'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Button } from './ui/button'
import { api } from '@/lib/api'
import { motion } from 'framer-motion'

interface CreateProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateProjectDialog({ open, onOpenChange }: CreateProjectDialogProps) {
  const [name, setName] = useState('')
  const [repoUrl, setRepoUrl] = useState('')
  const [urlError, setUrlError] = useState('')
  const [urlValid, setUrlValid] = useState(false)
  const queryClient = useQueryClient()

  const validateGitUrl = (url: string): boolean => {
    // Only accept PixelFathom SSH URLs
    const pixelFathomSSHPattern = /^git@github\.com:PixelFathom\/[a-zA-Z0-9_-]+\.git$/
    return pixelFathomSSHPattern.test(url)
  }

  const createMutation = useMutation({
    mutationFn: api.createProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      onOpenChange(false)
      setName('')
      setRepoUrl('')
      setUrlError('')
      setUrlValid(false)
    },
    onError: (error: any) => {
      // Handle validation error from backend
      if (error.message?.includes('PixelFathom')) {
        setUrlError(error.message)
      } else {
        setUrlError('Failed to create project. Please try again.')
      }
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateGitUrl(repoUrl)) {
      setUrlError('Only PixelFathom GitHub SSH URLs are allowed (e.g., git@github.com:PixelFathom/repo-name.git)')
      return
    }
    
    setUrlError('')
    createMutation.mutate({ name, repo_url: repoUrl })
  }

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setRepoUrl(value)
    
    // Real-time validation
    if (value && value.length > 10) { // Only validate after user has typed a bit
      if (!validateGitUrl(value)) {
        setUrlError('Only PixelFathom GitHub SSH URLs are allowed (e.g., git@github.com:PixelFathom/repo-name.git)')
        setUrlValid(false)
      } else {
        setUrlError('')
        setUrlValid(true)
      }
    } else {
      setUrlError('')
      setUrlValid(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] terminal-bg border-cyan-500/50">
        {/* Terminal header */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-2 border-b border-border bg-card/50">
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
            </div>
            <span className="text-xs font-mono text-muted-foreground">git-init-wizard</span>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="mt-8">
          <DialogHeader>
            <DialogTitle className="text-2xl font-mono flex items-center space-x-2">
              <RocketIcon className="h-6 w-6 text-cyan-500" />
              <span>Initialize New Repository</span>
            </DialogTitle>
            <DialogDescription className="font-mono text-sm text-muted-foreground">
              # Configure your new project repository
            </DialogDescription>
            <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-md">
              <p className="text-xs font-mono text-amber-500 flex items-center">
                <span className="mr-2">⚠️</span>
                Only PixelFathom organization repositories are accepted
              </p>
            </div>
          </DialogHeader>
          
          <div className="space-y-6 py-6 font-mono">
            {/* Info Box */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-4"
            >
              <div className="flex items-start space-x-2">
                <InfoCircledIcon className="h-5 w-5 text-cyan-500 mt-0.5" />
                <div className="text-xs space-y-1">
                  <p className="text-cyan-400 font-semibold">Repository Requirements:</p>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• Must be a PixelFathom organization repository</li>
                    <li>• SSH format required: <code className="text-cyan-300">git@github.com:PixelFathom/repo.git</code></li>
                    <li>• HTTPS URLs are not accepted</li>
                  </ul>
                </div>
              </div>
            </motion.div>

            {/* Project Name Input */}
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="space-y-2"
            >
              <div className="flex items-center space-x-2 text-sm">
                <span className="text-green-400">➜</span>
                <Label htmlFor="name" className="text-cyan-500">
                  project.name
                </Label>
                <span className="text-muted-foreground">=</span>
              </div>
              <div className="ml-6">
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder='"my-awesome-project"'
                  required
                  className="bg-card/50 border-muted-foreground/30 focus:border-cyan-500 font-mono text-purple-400 placeholder:text-muted-foreground/50"
                />
              </div>
            </motion.div>

            {/* Repository URL Input */}
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="space-y-2"
            >
              <div className="flex items-center space-x-2 text-sm">
                <span className="text-green-400">➜</span>
                <Label htmlFor="repo" className="text-cyan-500 flex items-center space-x-2">
                  <GitHubLogoIcon className="h-4 w-4" />
                  <span>remote.origin</span>
                </Label>
                <span className="text-muted-foreground">=</span>
              </div>
              <div className="ml-6">
                <div className="relative">
                  <Input
                    id="repo"
                    type="text"
                    value={repoUrl}
                    onChange={handleUrlChange}
                    placeholder='"git@github.com:PixelFathom/repo-name.git"'
                    required
                    className={`bg-card/50 border-muted-foreground/30 focus:border-cyan-500 font-mono text-yellow-400 placeholder:text-muted-foreground/50 pr-10 ${
                      urlValid ? 'border-green-500' : urlError ? 'border-red-500' : ''
                    }`}
                  />
                  {urlValid && (
                    <CheckCircledIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
                  )}
                </div>
                {urlError && (
                  <p className="text-red-400 text-xs mt-1 font-mono">{urlError}</p>
                )}
                <div className="mt-2 text-xs text-muted-foreground font-mono">
                  <p>Example: <code className="text-cyan-400">git@github.com:PixelFathom/cc-wrapper.git</code></p>
                  <p className="text-amber-400 mt-1">ℹ️ SSH format required for PixelFathom repos</p>
                </div>
              </div>
            </motion.div>

            {/* Preview */}
            {(name || repoUrl) && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="code-block mt-6 text-xs"
              >
                <div className="text-muted-foreground"># Preview configuration:</div>
                {name && (
                  <div>
                    <span className="text-purple-400">project</span>
                    <span className="text-muted-foreground">:</span> {name}
                  </div>
                )}
                {repoUrl && (
                  <div>
                    <span className="text-yellow-400">origin</span>
                    <span className="text-muted-foreground">:</span> {repoUrl}
                  </div>
                )}
              </motion.div>
            )}
          </div>
          
          <DialogFooter className="gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="font-mono hover:border-red-500/50 hover:text-red-500"
            >
              ^C Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={createMutation.isPending}
              className="bg-cyan-500 hover:bg-cyan-600 text-black font-mono hover:glow-cyan transition-all"
            >
              {createMutation.isPending ? (
                <span className="flex items-center">
                  <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-black mr-2"></span>
                  Initializing...
                </span>
              ) : (
                <span className="flex items-center">
                  <CheckCircledIcon className="mr-2 h-4 w-4" />
                  git init && push
                </span>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}