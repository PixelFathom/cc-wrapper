'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Textarea } from './ui/textarea'
import { Label } from './ui/label'
import { PlayIcon, UpdateIcon } from '@radix-ui/react-icons'
import { api, TestCase } from '@/lib/api'

interface TestCaseModalProps {
  taskId: string
  testCase?: TestCase
  trigger: React.ReactNode
  onSuccess: () => void
}

export function TestCaseModal({ taskId, testCase, trigger, onSuccess }: TestCaseModalProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    test_steps: '',
    expected_result: ''
  })

  // Reset form when modal opens/closes or testCase changes
  useEffect(() => {
    if (open) {
      setFormData({
        title: testCase?.title || '',
        description: testCase?.description || '',
        test_steps: testCase?.test_steps || '',
        expected_result: testCase?.expected_result || ''
      })
    }
  }, [open, testCase])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.title.trim() || !formData.test_steps.trim() || !formData.expected_result.trim()) {
      return
    }

    setLoading(true)
    try {
      if (testCase) {
        // Update existing test case
        await api.updateTestCase(testCase.id, formData)
      } else {
        // Create new test case
        await api.createTestCase(taskId, formData)
      }
      
      onSuccess()
      setOpen(false)
      setFormData({
        title: '',
        description: '',
        test_steps: '',
        expected_result: ''
      })
    } catch (error) {
      console.error('Failed to save test case:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="w-[96vw] max-w-2xl max-h-[96vh] sm:max-h-[92vh] overflow-y-auto mx-auto p-4 sm:p-6">
        <DialogHeader className="space-y-3 pb-3 border-b border-border/30">
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl font-semibold">
            <div className="bg-cyan-500/20 p-2 rounded-lg">
              <PlayIcon className="h-4 w-4 sm:h-5 sm:w-5 text-cyan-400" />
            </div>
            <span className="bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
              {testCase ? 'Edit Test Case' : 'Create New Test Case'}
            </span>
          </DialogTitle>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
            {testCase ? 'Update the test case details below.' : 'Define a comprehensive test case to ensure quality and reliability.'}
          </p>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6 pt-4">
          {/* Title Field - Enhanced Mobile Design */}
          <div className="space-y-3">
            <Label htmlFor="title" className="text-sm font-semibold flex items-center gap-2 text-foreground">
              <div className="w-2 h-2 rounded-full bg-cyan-400" />
              Title 
              <span className="text-red-400 text-lg">*</span>
            </Label>
            <div className="relative">
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="e.g., Login form validation test"
                required
                className="h-12 sm:h-11 text-sm sm:text-base pl-4 bg-card/50 border-border/60 focus:border-cyan-400 focus:ring-cyan-400/20 transition-all duration-200"
                autoFocus={!testCase}
              />
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-muted-foreground/60" />
              Use a clear, specific title that describes what you're testing
            </p>
          </div>

          {/* Description Field - Enhanced Mobile Design */}
          <div className="space-y-3">
            <Label htmlFor="description" className="text-sm font-semibold flex items-center gap-2 text-foreground">
              <div className="w-2 h-2 rounded-full bg-purple-400" />
              Description
              <span className="text-xs font-normal text-muted-foreground">(Optional)</span>
            </Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="e.g., Verify that users can successfully log in with valid credentials"
              rows={3}
              className="text-sm sm:text-base resize-none bg-card/50 border-border/60 focus:border-purple-400 focus:ring-purple-400/20 transition-all duration-200 min-h-[80px]"
            />
            <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-muted-foreground/60" />
              Briefly describe the purpose and scope of this test
            </p>
          </div>

          {/* Test Steps Field - Enhanced Mobile Design */}
          <div className="space-y-3">
            <Label htmlFor="test_steps" className="text-sm font-semibold flex items-center gap-2 text-foreground">
              <div className="w-2 h-2 rounded-full bg-blue-400" />
              Test Steps 
              <span className="text-red-400 text-lg">*</span>
            </Label>
            <div className="relative">
              <Textarea
                id="test_steps"
                value={formData.test_steps}
                onChange={(e) => setFormData(prev => ({ ...prev, test_steps: e.target.value }))}
                placeholder="1. Navigate to login page&#10;2. Enter valid username and password&#10;3. Click login button&#10;4. Verify successful login"
                rows={6}
                required
                className="text-sm sm:text-base font-mono resize-none bg-card/50 border-border/60 focus:border-blue-400 focus:ring-blue-400/20 transition-all duration-200 min-h-[140px] leading-relaxed"
              />
              <div className="absolute top-3 right-3 text-xs text-muted-foreground bg-card/80 px-2 py-1 rounded">
                Steps
              </div>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-muted-foreground/60" />
              Number each step clearly - be specific and actionable
            </p>
          </div>

          {/* Expected Result Field - Enhanced Mobile Design */}
          <div className="space-y-3">
            <Label htmlFor="expected_result" className="text-sm font-semibold flex items-center gap-2 text-foreground">
              <div className="w-2 h-2 rounded-full bg-green-400" />
              Expected Result 
              <span className="text-red-400 text-lg">*</span>
            </Label>
            <div className="relative">
              <Textarea
                id="expected_result"
                value={formData.expected_result}
                onChange={(e) => setFormData(prev => ({ ...prev, expected_result: e.target.value }))}
                placeholder="User is successfully logged in and redirected to dashboard. Success message is displayed."
                rows={4}
                required
                className="text-sm sm:text-base resize-none bg-card/50 border-border/60 focus:border-green-400 focus:ring-green-400/20 transition-all duration-200 min-h-[100px] leading-relaxed"
              />
              <div className="absolute top-3 right-3 text-xs text-muted-foreground bg-card/80 px-2 py-1 rounded">
                Result
              </div>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-muted-foreground/60" />
              Define clear success criteria - what indicates the test passed?
            </p>
          </div>

          {/* Enhanced Mobile-Optimized Action Buttons */}
          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-6 border-t border-border/30">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
              className="h-12 sm:h-11 font-medium text-sm sm:text-base border-border/60 hover:border-border/80 transition-all duration-200"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !formData.title.trim() || !formData.test_steps.trim() || !formData.expected_result.trim()}
              className="h-12 sm:h-11 font-medium text-sm sm:text-base bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 hover:from-cyan-600 hover:via-blue-600 hover:to-purple-600 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-200 flex-1 sm:flex-none sm:min-w-[160px]"
            >
              {loading ? (
                <>
                  <UpdateIcon className="h-4 w-4 mr-2 animate-spin" />
                  <span className="hidden sm:inline">Processing...</span>
                  <span className="sm:hidden">Creating...</span>
                </>
              ) : (
                <>
                  <PlayIcon className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">
                    {testCase ? 'Update Test Case' : 'Create Test Case'}
                  </span>
                  <span className="sm:hidden">
                    {testCase ? 'Update' : 'Create'}
                  </span>
                </>
              )}
            </Button>
          </div>

          {/* Enhanced Mobile Tips Section */}
          <div className="bg-gradient-to-r from-cyan-500/5 to-purple-500/5 rounded-lg p-4 border border-cyan-500/20 sm:hidden">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-full bg-gradient-to-r from-cyan-500 to-purple-500 flex items-center justify-center">
                <span className="text-white text-xs font-bold">💡</span>
              </div>
              <p className="text-sm font-semibold text-foreground">Quick Tips</p>
            </div>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-1.5 shrink-0" />
                <span>Keep titles concise but descriptive</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                <span>Number steps sequentially (1, 2, 3...)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 mt-1.5 shrink-0" />
                <span>Define measurable success criteria</span>
              </li>
            </ul>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}