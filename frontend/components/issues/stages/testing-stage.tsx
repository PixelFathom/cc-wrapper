"use client"

import { useQuery } from "@tanstack/react-query"
import { format } from "date-fns"
import {
  FlaskConical,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Play,
  FileText,
  Bug,
  CheckSquare,
  Square,
  RotateCw,
  Sparkles,
  Terminal,
  FileCheck,
  Clock
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import api from "@/lib/api"
import { cn } from "@/lib/utils"
import { motion, AnimatePresence } from "framer-motion"

interface TestingStageProps {
  taskId: string
  stageData: any
}

interface TestCase {
  id: string
  name: string
  description: string
  status: 'pending' | 'running' | 'passed' | 'failed' | 'skipped'
  result?: {
    passed: boolean
    message?: string
    duration?: number
    error?: string
  }
  type: 'unit' | 'integration' | 'e2e' | 'performance'
  coverage?: number
  created_at: string
  executed_at?: string
}

export function TestingStage({ taskId, stageData }: TestingStageProps) {
  // Fetch test cases
  const { data: testCases, refetch: refetchTestCases } = useQuery({
    queryKey: ['task-test-cases', taskId],
    queryFn: () => api.getTaskTestCases(taskId),
    refetchInterval: !stageData?.complete ? 3000 : false,
  })

  // Fetch test execution hooks/logs
  const { data: testHooks } = useQuery({
    queryKey: ['test-case-hooks', taskId],
    queryFn: () => api.getTestCaseHooks(taskId),
    refetchInterval: !stageData?.complete ? 3000 : false,
  })

  // Calculate test metrics
  const getTestMetrics = () => {
    if (!testCases?.test_cases) {
      return {
        total: 0,
        passed: 0,
        failed: 0,
        pending: 0,
        coverage: 0,
        successRate: 0
      }
    }

    const cases = testCases.test_cases as TestCase[]
    const total = cases.length
    const passed = cases.filter((t: TestCase) => t.status === 'passed').length
    const failed = cases.filter((t: TestCase) => t.status === 'failed').length
    const pending = cases.filter((t: TestCase) => t.status === 'pending').length
    const coverage = cases.reduce((acc: number, t: TestCase) => acc + (t.coverage || 0), 0) / (total || 1)
    const successRate = total > 0 ? (passed / total) * 100 : 0

    return { total, passed, failed, pending, coverage, successRate }
  }

  const metrics = getTestMetrics()

  // Get test progress
  const getTestProgress = () => {
    if (stageData?.complete) return 100
    if (!testCases?.test_cases) return 0

    const cases = testCases.test_cases as TestCase[]
    const completed = cases.filter((t: TestCase) =>
      t.status === 'passed' || t.status === 'failed' || t.status === 'skipped'
    ).length

    return cases.length > 0 ? Math.round((completed / cases.length) * 100) : 0
  }

  const progress = getTestProgress()

  // Handle test case regeneration
  const handleRegenerateTests = async () => {
    try {
      await api.generateTestCases(taskId, {
        test_types: ['unit', 'integration', 'e2e'],
        auto_execute: true
      })
      refetchTestCases()
    } catch (error) {
      console.error('Failed to regenerate tests:', error)
    }
  }

  // Handle individual test execution
  const handleExecuteTest = async (testCaseId: string) => {
    try {
      await api.executeTestCase(testCaseId)
      refetchTestCases()
    } catch (error) {
      console.error('Failed to execute test:', error)
    }
  }

  const getTestTypeIcon = (type: string) => {
    switch (type) {
      case 'unit': return FileCheck
      case 'integration': return Terminal
      case 'e2e': return FlaskConical
      case 'performance': return Clock
      default: return FileText
    }
  }

  const getTestStatusIcon = (status: string) => {
    switch (status) {
      case 'passed': return CheckCircle
      case 'failed': return XCircle
      case 'running': return Loader2
      case 'skipped': return Square
      default: return Square
    }
  }

  const getTestStatusColor = (status: string) => {
    switch (status) {
      case 'passed': return 'text-green-600'
      case 'failed': return 'text-red-600'
      case 'running': return 'text-blue-600'
      case 'skipped': return 'text-gray-400'
      default: return 'text-muted-foreground'
    }
  }

  return (
    <div className="space-y-4">
      {/* Stage Info */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Status</p>
          <Badge variant={stageData?.complete ? "success" : "default"}>
            {stageData?.complete ? 'Complete' : 'In Progress'}
          </Badge>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Started</p>
          <p className="text-sm font-medium">
            {stageData?.started_at
              ? format(new Date(stageData.started_at), 'MMM d, HH:mm')
              : '-'}
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Completed</p>
          <p className="text-sm font-medium">
            {stageData?.completed_at
              ? format(new Date(stageData.completed_at), 'MMM d, HH:mm')
              : '-'}
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Test Suite</p>
          <Badge variant="outline" className="text-xs">
            <Sparkles className="h-3 w-3 mr-1" />
            AI Generated
          </Badge>
        </div>
      </div>

      <Separator />

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Test Execution Progress</p>
          <span className="text-sm text-muted-foreground">{progress}%</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Test Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <CheckSquare className="h-4 w-4" />
              Total Tests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{metrics.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              Passed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{metrics.passed}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-600" />
              Failed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">{metrics.failed}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <FlaskConical className="h-4 w-4" />
              Success Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {metrics.successRate.toFixed(0)}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Test Results Tabs */}
      <Tabs defaultValue="tests" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="tests">Test Cases</TabsTrigger>
          <TabsTrigger value="failures">Failures</TabsTrigger>
          <TabsTrigger value="output">Test Output</TabsTrigger>
        </TabsList>

        {/* Test Cases Tab */}
        <TabsContent value="tests">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Test Cases</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRegenerateTests}
                  disabled={!stageData?.complete}
                >
                  <RotateCw className="h-3 w-3 mr-1" />
                  Regenerate
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-64 w-full">
                {testCases?.test_cases && testCases.test_cases.length > 0 ? (
                  <div className="space-y-2">
                    {(testCases.test_cases as TestCase[]).map((testCase) => {
                      const StatusIcon = getTestStatusIcon(testCase.status)
                      const TypeIcon = getTestTypeIcon(testCase.type)

                      return (
                        <motion.div
                          key={testCase.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className={cn(
                            "flex items-start gap-3 p-3 rounded-lg border transition-colors",
                            testCase.status === 'failed' && "bg-red-50 border-red-200 dark:bg-red-950/20",
                            testCase.status === 'passed' && "bg-green-50 border-green-200 dark:bg-green-950/20",
                            testCase.status === 'running' && "bg-blue-50 border-blue-200 dark:bg-blue-950/20"
                          )}
                        >
                          <div className={cn(
                            "flex h-8 w-8 items-center justify-center rounded-full bg-muted",
                            getTestStatusColor(testCase.status)
                          )}>
                            {testCase.status === 'running' ? (
                              <StatusIcon className="h-4 w-4 animate-spin" />
                            ) : (
                              <StatusIcon className="h-4 w-4" />
                            )}
                          </div>
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium">{testCase.name}</p>
                              <Badge variant="outline" className="text-xs">
                                <TypeIcon className="h-3 w-3 mr-1" />
                                {testCase.type}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {testCase.description}
                            </p>
                            {testCase.result && (
                              <div className="mt-1">
                                {testCase.result.error ? (
                                  <p className="text-xs text-red-600 font-mono">
                                    {testCase.result.error}
                                  </p>
                                ) : testCase.result.message && (
                                  <p className="text-xs text-muted-foreground">
                                    {testCase.result.message}
                                  </p>
                                )}
                                {testCase.result.duration && (
                                  <p className="text-xs text-muted-foreground">
                                    Duration: {testCase.result.duration}ms
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                          {testCase.status === 'pending' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleExecuteTest(testCase.id)}
                            >
                              <Play className="h-3 w-3" />
                            </Button>
                          )}
                        </motion.div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8">
                    <FlaskConical className="h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">Generating test cases...</p>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Failures Tab */}
        <TabsContent value="failures">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Bug className="h-4 w-4" />
                Failed Tests
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-64 w-full">
                {testCases?.test_cases && (testCases.test_cases as TestCase[]).filter(t => t.status === 'failed').length > 0 ? (
                  <div className="space-y-3">
                    {(testCases.test_cases as TestCase[])
                      .filter(t => t.status === 'failed')
                      .map((testCase) => (
                        <div key={testCase.id} className="space-y-2 pb-3 border-b last:border-0">
                          <div className="flex items-center gap-2">
                            <XCircle className="h-4 w-4 text-red-600" />
                            <p className="text-sm font-medium">{testCase.name}</p>
                          </div>
                          {testCase.result?.error && (
                            <pre className="text-xs font-mono bg-red-50 dark:bg-red-950/20 p-2 rounded overflow-x-auto">
                              {testCase.result.error}
                            </pre>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleExecuteTest(testCase.id)}
                          >
                            <RotateCw className="h-3 w-3 mr-1" />
                            Retry Test
                          </Button>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8">
                    <CheckCircle className="h-8 w-8 text-green-600 mb-2" />
                    <p className="text-sm text-muted-foreground">No test failures</p>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Test Output Tab */}
        <TabsContent value="output">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Terminal className="h-4 w-4" />
                Test Execution Output
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-64 w-full">
                {testHooks?.hooks && testHooks.hooks.length > 0 ? (
                  <div className="space-y-2">
                    {testHooks.hooks.map((hook: any) => (
                      <div key={hook.id} className="flex gap-2 text-xs font-mono">
                        <span className="text-muted-foreground">
                          [{format(new Date(hook.received_at), 'HH:mm:ss')}]
                        </span>
                        <span className={cn(
                          "flex-1",
                          hook.status === 'error' && "text-red-600",
                          hook.status === 'success' && "text-green-600"
                        )}>
                          {hook.message || hook.data?.output || `${hook.hook_type}: ${hook.status}`}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">Waiting for test output...</p>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Summary for completed stage */}
      {stageData?.complete && (
        <>
          <Separator />
          <Card className={cn(
            "border-2",
            metrics.failed > 0
              ? "border-amber-200 bg-amber-50 dark:bg-amber-950/20"
              : "border-green-200 bg-green-50 dark:bg-green-950/20"
          )}>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                {metrics.failed > 0 ? (
                  <>
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                    Testing Complete with Failures
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    All Tests Passed
                  </>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Testing has been completed. {metrics.passed} out of {metrics.total} tests passed
                {metrics.failed > 0 && ` with ${metrics.failed} failure${metrics.failed > 1 ? 's' : ''}.`}
                {metrics.failed === 0 && '. The implementation is verified and ready for deployment.'}
              </p>
              {metrics.coverage > 0 && (
                <div className="mt-2">
                  <p className="text-xs text-muted-foreground mb-1">Code Coverage</p>
                  <Progress value={metrics.coverage} className="h-1" />
                  <p className="text-xs text-muted-foreground mt-1">{metrics.coverage.toFixed(1)}%</p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}