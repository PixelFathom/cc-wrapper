'use client'

import { useQuery } from '@tanstack/react-query'
import { PlusIcon } from '@radix-ui/react-icons'
import { motion } from 'framer-motion'
import { ProjectCard } from './project-card'
import { Button } from './ui/button'
import { Skeleton } from './ui/skeleton'
import { api } from '@/lib/api'
import { useState } from 'react'
import { CreateProjectDialog } from './create-project-dialog'

export function ProjectList() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  
  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: api.getProjects,
  })

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="gradient-border-neon rounded-lg h-48 sm:h-40 bg-card/50"></div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {projects?.map((project, index) => (
          <ProjectCard key={project.id} project={project} index={index} />
        ))}
        
        {/* Add new project card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: (projects?.length || 0) * 0.1 }}
          onClick={() => setCreateDialogOpen(true)}
          className="group cursor-pointer h-full"
        >
          <div className="relative h-full gradient-border-neon rounded-lg overflow-hidden hover:glow-purple transition-all duration-300 border-dashed">
            {/* Terminal header */}
            <div className="bg-card/80 border-b border-border px-4 py-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="flex items-center space-x-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/50"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500/50"></div>
                  </div>
                  <span className="text-xs font-mono text-muted-foreground">~/projects/new</span>
                </div>
              </div>
            </div>

            {/* Terminal content */}
            <div className="bg-card/50 p-4 font-mono text-sm min-h-[140px] sm:min-h-[120px] flex items-center justify-center">
              <div className="text-center">
                <div className="mb-3">
                  <span className="text-green-400">➜</span>
                  <span className="text-cyan-500 ml-2">git</span>
                  <span className="text-muted-foreground ml-2">init</span>
                  <span className="text-purple-400 ml-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">new-project</span>
                </div>
                <div className="flex items-center justify-center space-x-2 text-muted-foreground group-hover:text-cyan-500 transition-colors">
                  <PlusIcon className="h-5 w-5" />
                  <span className="text-sm">Create New Project</span>
                </div>
              </div>
            </div>

            {/* Bottom status bar */}
            <div className="absolute bottom-0 left-0 right-0 bg-black/20 border-t border-border/50 px-4 py-1 flex items-center justify-center text-xs font-mono">
              <span className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                Press to initialize new repository
              </span>
            </div>
          </div>
        </motion.div>
      </div>
      
      <CreateProjectDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
    </>
  )
}