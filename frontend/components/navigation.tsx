'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CodeIcon, HamburgerMenuIcon, Cross2Icon, RocketIcon } from '@radix-ui/react-icons'
import { Button } from './ui/button'
import { SignInButton, SignUpButton, SignedIn, SignedOut, UserButton } from '@clerk/nextjs'
import { DeploymentGuideModal } from './deployment-guide-modal'
import { usePathname } from 'next/navigation'

export function Navigation() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const pathname = usePathname()

  // Extract taskId from URL path like /p/[projectId]/t/[taskId]
  const taskId = pathname?.match(/\/p\/[^\/]+\/t\/([^\/]+)/)?.[1]

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])


  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled 
          ? 'terminal-bg border-b border-border' 
          : 'bg-transparent'
      }`}
    >
      <nav className="container mx-auto px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-3">
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-lg blur opacity-25 group-hover:opacity-75 transition duration-300"></div>
              <div className="relative flex items-center space-x-2 bg-card px-2 sm:px-3 py-1.5 rounded-lg border border-border">
                <CodeIcon className="h-4 sm:h-5 w-4 sm:w-5 text-cyan-500" />
                <span className="font-mono text-xs sm:text-sm">
                  <span className="text-muted-foreground">$</span>
                  <span className="text-cyan-500 ml-1">project</span>
                  <span className="text-muted-foreground hidden sm:inline">-hub</span>
                  <span className="animate-terminal-cursor ml-0.5">_</span>
                </span>
              </div>
            </div>
          </Link>

          {/* Desktop menu */}
          <div className="hidden md:flex items-center space-x-4">
            <div className="flex items-center space-x-1 bg-card/50 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-border">
              <span className="text-muted-foreground text-xs font-mono">v1.0.0</span>
              <span className="text-cyan-500 text-xs">●</span>
              <span className="text-muted-foreground text-xs font-mono">main</span>
            </div>
            
            {/* Deployment Guide Button - Only show on task pages */}
            {taskId && (
              <DeploymentGuideModal
                taskId={taskId}
                trigger={
                  <Button
                    size="sm"
                    variant="outline"
                    className="bg-gradient-to-r from-orange-500/10 to-red-500/10 border-orange-500/30 hover:border-orange-400/50 text-orange-400 hover:text-orange-300 hover:bg-orange-500/20 transition-all duration-200"
                  >
                    <RocketIcon className="h-4 w-4 mr-2" />
                    Deployment Guide
                  </Button>
                }
              />
            )}
            
            {/* Auth buttons */}
            <SignedOut>
              <SignInButton mode="modal">
                <Button variant="ghost" size="sm">
                  Sign In
                </Button>
              </SignInButton>
              <SignUpButton mode="modal">
                <Button size="sm" className="bg-cyan-600 hover:bg-cyan-700">
                  Sign Up
                </Button>
              </SignUpButton>
            </SignedOut>
            <SignedIn>
              <UserButton />
            </SignedIn>
          </div>

          {/* Mobile menu button */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? (
              <Cross2Icon className="h-5 w-5" />
            ) : (
              <HamburgerMenuIcon className="h-5 w-5" />
            )}
          </Button>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden mt-4 border-t border-border pt-4"
            >
              <div className="flex flex-col space-y-3">
                <div className="text-center py-4">
                  <span className="text-xs text-muted-foreground font-mono">v1.0.0</span>
                </div>
                
                {/* Deployment Guide Button - Mobile */}
                {taskId && (
                  <div className="px-4">
                    <DeploymentGuideModal
                      taskId={taskId}
                      trigger={
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full bg-gradient-to-r from-orange-500/10 to-red-500/10 border-orange-500/30 hover:border-orange-400/50 text-orange-400 hover:text-orange-300 hover:bg-orange-500/20 transition-all duration-200"
                        >
                          <RocketIcon className="h-4 w-4 mr-2" />
                          Deployment Guide
                        </Button>
                      }
                    />
                  </div>
                )}
                
                {/* Mobile auth buttons */}
                <SignedOut>
                  <div className="flex flex-col space-y-2 px-4">
                    <SignInButton mode="modal">
                      <Button variant="ghost" size="sm" className="w-full">
                        Sign In
                      </Button>
                    </SignInButton>
                    <SignUpButton mode="modal">
                      <Button size="sm" className="w-full bg-cyan-600 hover:bg-cyan-700">
                        Sign Up
                      </Button>
                    </SignUpButton>
                  </div>
                </SignedOut>
                <SignedIn>
                  <div className="flex justify-center">
                    <UserButton />
                  </div>
                </SignedIn>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>
    </motion.header>
  )
}