'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { 
  Cross2Icon, PlayIcon, UpdateIcon, CheckCircledIcon, CrossCircledIcon,
  MixerHorizontalIcon, CodeIcon, ListBulletIcon, ClockIcon, 
  DotFilledIcon, FileTextIcon, CheckIcon, EyeOpenIcon
} from '@radix-ui/react-icons'
import { api } from '@/lib/api'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { Input } from './ui/input'
import { Textarea } from './ui/textarea'
import { Badge } from './ui/badge'
import { cn } from '@/lib/utils'

interface TestCase {
  id: string
  title: string
  description: string
  test_steps: string
  expected_result: string
  status: 'pending' | 'running' | 'passed' | 'failed'
  source: 'manual' | 'ai_generated'
  session_id?: string
  ai_model_used?: string
  last_execution_at?: string
  execution_result?: string
  created_at: string
  category?: string
}

interface TestCaseGenerationModalProps {
  isOpen: boolean
  onClose: () => void
  sessionId: string
  taskId?: string
}

interface GenerationRequest {
  session_id: string
  max_test_cases: number
  focus_areas: string[]
}

export function TestCaseGenerationModal({ 
  isOpen, 
  onClose, 
  sessionId,
  taskId 
}: TestCaseGenerationModalProps) {
  const queryClient = useQueryClient()
  const [maxTestCases, setMaxTestCases] = useState(5)
  const [focusAreas, setFocusAreas] = useState<string>('')
  const [selectedTestCases, setSelectedTestCases] = useState<Set<string>>(new Set())
  const [showExecutionResults, setShowExecutionResults] = useState(false)
  const [generatedTestCases, setGeneratedTestCases] = useState<TestCase[]>([])

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setSelectedTestCases(new Set())
      setShowExecutionResults(false)
      setGeneratedTestCases([])
    }
  }, [isOpen])

  // Generate test cases mutation
  const generateMutation = useMutation({
    mutationFn: async (request: GenerationRequest) => {
      const response = await api.generateTestCasesFromSession(sessionId, request)
      return response
    },
    onSuccess: (data) => {
      console.log('✅ Test cases generated:', data)
      setGeneratedTestCases(data.test_cases || [])
      // Select all generated test cases by default
      const allIds = new Set(data.test_cases?.map((tc: TestCase) => tc.id) || [])
      setSelectedTestCases(allIds)
    },
    onError: (error) => {
      console.error('❌ Error generating test cases:', error)
    }
  })

  // Execute test cases mutation
  const executeMutation = useMutation({
    mutationFn: async (testCaseIds: string[]) => {
      // Execute each test case individually
      const results = await Promise.allSettled(
        testCaseIds.map(id => api.executeTestCase(id))
      )
      return results
    },
    onSuccess: (results) => {
      console.log('✅ Test case execution started:', results)
      setShowExecutionResults(true)
      // Refresh test case data to get execution status
      queryClient.invalidateQueries({ queryKey: ['test-cases'] })
    }
  })

  // Generate and execute in one go
  const generateAndExecuteMutation = useMutation({
    mutationFn: async (request: GenerationRequest) => {
      const response = await api.generateAndExecuteTestCases(sessionId, request)
      return response
    },
    onSuccess: (data) => {
      console.log('✅ Test cases generated and execution started:', data)
      setShowExecutionResults(true)
      // Refresh to get the actual test case data
      setTimeout(() => {
        if (taskId) {
          queryClient.invalidateQueries({ queryKey: ['test-cases', taskId] })
        }
      }, 1000)
    }
  })

  // Fetch existing test cases for this task
  const { data: existingTestCases, refetch: refetchTestCases } = useQuery({
    queryKey: ['test-cases', taskId],
    queryFn: () => taskId ? api.getTestCases(taskId) : Promise.resolve([]),
    enabled: !!taskId && isOpen,
    refetchInterval: showExecutionResults ? 3000 : false, // Poll when execution is in progress
  })

  const handleGenerate = () => {
    const focusAreasArray = focusAreas
      .split(',')
      .map(area => area.trim())
      .filter(area => area.length > 0)

    generateMutation.mutate({
      session_id: sessionId,
      max_test_cases: maxTestCases,
      focus_areas: focusAreasArray
    })
  }

  const handleExecuteSelected = () => {
    const selectedIds = Array.from(selectedTestCases)
    if (selectedIds.length > 0) {
      executeMutation.mutate(selectedIds)
    }
  }

  const handleGenerateAndExecute = () => {
    const focusAreasArray = focusAreas
      .split(',')
      .map(area => area.trim())
      .filter(area => area.length > 0)

    generateAndExecuteMutation.mutate({
      session_id: sessionId,
      max_test_cases: maxTestCases,
      focus_areas: focusAreasArray
    })
  }

  const toggleTestCaseSelection = (id: string) => {
    const newSelected = new Set(selectedTestCases)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedTestCases(newSelected)
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <ClockIcon className="h-4 w-4 text-gray-500" />
      case 'running':
        return <UpdateIcon className="h-4 w-4 text-blue-500 animate-spin" />
      case 'passed':
        return <CheckCircledIcon className="h-4 w-4 text-green-500" />
      case 'failed':
        return <CrossCircledIcon className="h-4 w-4 text-red-500" />
      default:
        return <DotFilledIcon className="h-4 w-4 text-gray-500" />
    }
  }

  const getCategoryColor = (category?: string) => {
    switch (category) {
      case 'feature':
        return 'bg-blue-500/20 text-blue-400'
      case 'api':
        return 'bg-green-500/20 text-green-400'
      case 'ui':
        return 'bg-purple-500/20 text-purple-400'
      case 'error_handling':
        return 'bg-red-500/20 text-red-400'
      case 'performance':
        return 'bg-orange-500/20 text-orange-400'
      case 'security':
        return 'bg-yellow-500/20 text-yellow-400'
      default:
        return 'bg-gray-500/20 text-gray-400'
    }
  }

  // Combine generated and existing test cases for display
  const allTestCases = showExecutionResults ? existingTestCases || [] : generatedTestCases
  const aiGeneratedCases = allTestCases.filter((tc: TestCase) => 
    tc.source === 'ai_generated' && tc.session_id === sessionId
  )

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MixerHorizontalIcon className="h-5 w-5 text-cyan-500" />
            AI Test Case Generator
            <Badge variant="outline" className="text-xs">
              Session: {sessionId.slice(0, 8)}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6 pr-2">
          {/* Generation Controls */}
          {!showExecutionResults && (
            <div className="space-y-4 p-4 bg-card/30 rounded-lg border">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Maximum Test Cases
                  </label>
                  <Input
                    type="number"
                    min="1"
                    max="20"
                    value={maxTestCases}
                    onChange={(e) => setMaxTestCases(parseInt(e.target.value) || 5)}
                    className="bg-background/50"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Focus Areas (comma-separated)
                  </label>
                  <Input
                    placeholder="e.g., API testing, UI validation, error handling"
                    value={focusAreas}
                    onChange={(e) => setFocusAreas(e.target.value)}
                    className="bg-background/50"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={handleGenerate}
                  disabled={generateMutation.isPending}
                  className="bg-cyan-500 hover:bg-cyan-600 text-black font-medium"
                >
                  {generateMutation.isPending ? (
                    <>
                      <UpdateIcon className="h-4 w-4 animate-spin mr-2" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <MixerHorizontalIcon className="h-4 w-4 mr-2" />
                      Generate Test Cases
                    </>
                  )}
                </Button>

                <Button
                  onClick={handleGenerateAndExecute}
                  disabled={generateAndExecuteMutation.isPending}
                  className="bg-green-500 hover:bg-green-600 text-black font-medium"
                >
                  {generateAndExecuteMutation.isPending ? (
                    <>
                      <UpdateIcon className="h-4 w-4 animate-spin mr-2" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <PlayIcon className="h-4 w-4 mr-2" />
                      Generate & Execute
                    </>
                  )}
                </Button>
              </div>

              <div className="text-sm text-muted-foreground">
                💡 AI will analyze your chat conversation to create specific, actionable test cases
              </div>
            </div>
          )}

          {/* Error Display */}
          {(generateMutation.error || executeMutation.error || generateAndExecuteMutation.error) && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
              <div className="text-red-400 text-sm">
                Error: {generateMutation.error?.message || executeMutation.error?.message || generateAndExecuteMutation.error?.message}
              </div>
            </div>
          )}

          {/* Generated Test Cases */}
          {generatedTestCases.length > 0 && !showExecutionResults && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <CheckIcon className="h-5 w-5 text-green-500" />
                  Generated Test Cases ({generatedTestCases.length})
                </h3>
                {selectedTestCases.size > 0 && (
                  <Button
                    onClick={handleExecuteSelected}
                    disabled={executeMutation.isPending}
                    size="sm"
                    className="bg-blue-500 hover:bg-blue-600 text-white"
                  >
                    {executeMutation.isPending ? (
                      <>
                        <UpdateIcon className="h-4 w-4 animate-spin mr-2" />
                        Executing...
                      </>
                    ) : (
                      <>
                        <PlayIcon className="h-4 w-4 mr-2" />
                        Execute Selected ({selectedTestCases.size})
                      </>
                    )}
                  </Button>
                )}
              </div>

              <div className="space-y-3">
                {generatedTestCases.map((testCase) => (
                  <motion.div
                    key={testCase.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "p-4 rounded-lg border transition-all duration-200 cursor-pointer",
                      selectedTestCases.has(testCase.id)
                        ? "bg-cyan-500/10 border-cyan-500/30"
                        : "bg-card/50 border-border hover:bg-card/70"
                    )}
                    onClick={() => toggleTestCaseSelection(testCase.id)}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "w-5 h-5 rounded border-2 flex items-center justify-center mt-0.5",
                        selectedTestCases.has(testCase.id)
                          ? "bg-cyan-500 border-cyan-500"
                          : "border-gray-500"
                      )}>
                        {selectedTestCases.has(testCase.id) && (
                          <CheckIcon className="h-3 w-3 text-white" />
                        )}
                      </div>
                      
                      <div className="flex-1 space-y-2">
                        <div className="flex items-start justify-between">
                          <h4 className="font-medium text-foreground">{testCase.title}</h4>
                          <div className="flex items-center gap-2">
                            {testCase.category && (
                              <Badge className={cn("text-xs", getCategoryColor(testCase.category))}>
                                {testCase.category}
                              </Badge>
                            )}
                            {getStatusIcon(testCase.status)}
                          </div>
                        </div>
                        
                        <p className="text-sm text-muted-foreground">{testCase.description}</p>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                          <div>
                            <div className="font-medium text-foreground mb-1">Test Steps:</div>
                            <div className="text-muted-foreground bg-background/50 p-2 rounded">
                              {testCase.test_steps}
                            </div>
                          </div>
                          <div>
                            <div className="font-medium text-foreground mb-1">Expected Result:</div>
                            <div className="text-muted-foreground bg-background/50 p-2 rounded">
                              {testCase.expected_result}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Execution Results */}
          {showExecutionResults && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <EyeOpenIcon className="h-5 w-5 text-blue-500" />
                  Test Execution Results
                </h3>
                <Button
                  onClick={() => refetchTestCases()}
                  size="sm"
                  variant="outline"
                >
                  <UpdateIcon className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>

              {aiGeneratedCases.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <UpdateIcon className="h-8 w-8 animate-spin mx-auto mb-4" />
                  <div>Loading test execution results...</div>
                </div>
              ) : (
                <div className="space-y-3">
                  {aiGeneratedCases.map((testCase: TestCase) => (
                    <motion.div
                      key={testCase.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 rounded-lg border bg-card/50"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <h4 className="font-medium text-foreground">{testCase.title}</h4>
                        <div className="flex items-center gap-2">
                          {testCase.category && (
                            <Badge className={cn("text-xs", getCategoryColor(testCase.category))}>
                              {testCase.category}
                            </Badge>
                          )}
                          {getStatusIcon(testCase.status)}
                          <span className="text-xs text-muted-foreground capitalize">
                            {testCase.status}
                          </span>
                        </div>
                      </div>

                      {testCase.execution_result && (
                        <div className="mt-3 p-3 bg-background/50 rounded text-sm">
                          <div className="font-medium text-foreground mb-2">Execution Result:</div>
                          <div className="text-muted-foreground whitespace-pre-wrap">
                            {testCase.execution_result}
                          </div>
                        </div>
                      )}

                      {testCase.last_execution_at && (
                        <div className="mt-2 text-xs text-muted-foreground">
                          Last executed: {new Date(testCase.last_execution_at).toLocaleString()}
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            {showExecutionResults 
              ? `Monitoring ${aiGeneratedCases.length} test case${aiGeneratedCases.length !== 1 ? 's' : ''}`
              : `Session: ${sessionId.slice(0, 8)}...`
            }
          </div>
          <Button variant="outline" onClick={onClose}>
            <Cross2Icon className="h-4 w-4 mr-2" />
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}