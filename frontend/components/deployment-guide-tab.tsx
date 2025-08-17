'use client'

import { useState, useEffect } from 'react'
import { Button } from './ui/button'
import { Textarea } from './ui/textarea'
import { Label } from './ui/label'
import { RocketIcon, UpdateIcon, ReaderIcon, GearIcon } from '@radix-ui/react-icons'
import { api } from '@/lib/api'
import { MarkdownRenderer } from './markdown-renderer'
import { motion } from 'framer-motion'

interface DeploymentGuideTabProps {
  taskId: string
}

export function DeploymentGuideTab({ taskId }: DeploymentGuideTabProps) {
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState(false)
  const [deploymentGuide, setDeploymentGuide] = useState('')
  const [editingContent, setEditingContent] = useState('')

  // Fetch deployment guide on component mount
  useEffect(() => {
    fetchDeploymentGuide()
  }, [taskId])

  const fetchDeploymentGuide = async () => {
    setLoading(true)
    try {
      const response = await api.getDeploymentGuide(taskId)
      setDeploymentGuide(response.content || '')
      setEditingContent(response.content || '')
    } catch (error) {
      console.error('Failed to fetch deployment guide:', error)
      // Set default template if no guide exists
      const defaultGuide = `# Deployment Guide

## Prerequisites
- Node.js 18+ installed
- npm or yarn package manager
- Git repository access

## Installation
\`\`\`bash
npm install
# or
yarn install
\`\`\`

## Development Server
\`\`\`bash
npm run dev
# or
yarn dev
\`\`\`

## Production Build
\`\`\`bash
npm run build
npm start
# or
yarn build
yarn start
\`\`\`

## Environment Variables
Create a \`.env\` file with the following variables:
\`\`\`
API_URL=http://localhost:8000
DATABASE_URL=your_database_url
\`\`\`

## Testing
\`\`\`bash
npm test
# or
yarn test
\`\`\`

## Deployment
1. Build the application
2. Set environment variables
3. Start the production server
4. Verify deployment health

## Troubleshooting
- Check logs for errors
- Verify environment variables
- Ensure all dependencies are installed
- Restart services if needed`
      setDeploymentGuide(defaultGuide)
      setEditingContent(defaultGuide)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setLoading(true)
    try {
      await api.updateDeploymentGuide(taskId, editingContent)
      setDeploymentGuide(editingContent)
      setEditing(false)
    } catch (error) {
      console.error('Failed to save deployment guide:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    setEditingContent(deploymentGuide)
    setEditing(false)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-r from-orange-500/20 to-red-500/20 p-3 rounded-xl border border-orange-500/30">
            <RocketIcon className="h-6 w-6 text-orange-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-orange-400 to-red-400 bg-clip-text text-transparent">
              Deployment Guide
            </h3>
            <p className="text-sm sm:text-base text-muted-foreground mt-1 leading-relaxed">
              Instructions for deploying, restarting, and testing this project
            </p>
          </div>
        </div>
        
        <div className="bg-gradient-to-r from-orange-500/5 to-red-500/5 rounded-lg p-4 border border-orange-500/20">
          <p className="text-sm text-muted-foreground leading-relaxed">
            This deployment guide is automatically shared with coding agents to provide context about how to deploy, restart services, and verify functionality in your environment.
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-gradient-to-br from-card/80 to-card rounded-xl border border-border/50 p-4 sm:p-6 backdrop-blur-sm">
        {/* Action Bar */}
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between mb-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ReaderIcon className="h-4 w-4" />
            <span>
              {editing ? 'Editing deployment instructions' : 'Viewing deployment guide'}
            </span>
          </div>
          
          <div className="flex gap-2">
            {!editing ? (
              <Button
                onClick={() => setEditing(true)}
                size="sm"
                variant="outline"
                className="border-orange-500/30 hover:border-orange-400/50 text-orange-400 hover:text-orange-300 hover:bg-orange-500/10"
              >
                <GearIcon className="h-4 w-4 mr-2" />
                Edit Guide
              </Button>
            ) : (
              <>
                <Button
                  onClick={handleCancel}
                  size="sm"
                  variant="outline"
                  disabled={loading}
                  className="border-border/60 hover:border-border/80"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  size="sm"
                  disabled={loading}
                  className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white border-0"
                >
                  {loading ? (
                    <>
                      <UpdateIcon className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Guide'
                  )}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Content Area */}
        <div className="min-h-[400px]">
          {loading && !editing ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center gap-3 text-muted-foreground">
                <UpdateIcon className="h-5 w-5 animate-spin" />
                <span>Loading deployment guide...</span>
              </div>
            </div>
          ) : editing ? (
            <div className="space-y-4">
              <Label htmlFor="deployment-guide" className="text-sm font-semibold flex items-center gap-2 text-foreground">
                <div className="w-2 h-2 rounded-full bg-orange-400" />
                Deployment Instructions
                <span className="text-xs font-normal text-muted-foreground">(Markdown supported)</span>
              </Label>
              <Textarea
                id="deployment-guide"
                value={editingContent}
                onChange={(e) => setEditingContent(e.target.value)}
                placeholder="Enter deployment instructions, server restart commands, testing procedures, and other relevant details..."
                rows={20}
                className="text-sm sm:text-base font-mono resize-none bg-card/50 border-border/60 focus:border-orange-400 focus:ring-orange-400/20 transition-all duration-200 min-h-[400px] leading-relaxed"
              />
              <div className="bg-gradient-to-r from-orange-500/5 to-red-500/5 rounded-lg p-4 border border-orange-500/20">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-r from-orange-500 to-red-500 flex items-center justify-center">
                    <span className="text-white text-xs font-bold">💡</span>
                  </div>
                  <p className="text-sm font-semibold text-foreground">Guide Tips</p>
                </div>
                <ul className="space-y-2 text-xs text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-400 mt-1.5 shrink-0" />
                    <span>Include specific commands for deployment and server restart</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5 shrink-0" />
                    <span>Document environment variables and configuration files</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 mt-1.5 shrink-0" />
                    <span>Add testing procedures and health check commands</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 mt-1.5 shrink-0" />
                    <span>Include troubleshooting steps for common issues</span>
                  </li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {deploymentGuide ? (
                <div className="bg-gradient-to-br from-card/60 to-card/80 rounded-xl border border-border/50 p-6 backdrop-blur-sm">
                  <MarkdownRenderer 
                    content={deploymentGuide}
                    className="prose prose-sm sm:prose-base max-w-none"
                  />
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="bg-gradient-to-br from-orange-500/20 to-red-500/20 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center border border-orange-500/30">
                    <ReaderIcon className="h-8 w-8 text-orange-400" />
                  </div>
                  <h4 className="text-lg font-semibold text-foreground mb-2">No Deployment Guide</h4>
                  <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
                    Create a deployment guide to help coding agents understand how to deploy, restart, and test this project.
                  </p>
                  <Button
                    onClick={() => setEditing(true)}
                    size="sm"
                    className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white border-0"
                  >
                    <RocketIcon className="h-4 w-4 mr-2" />
                    Create Guide
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}