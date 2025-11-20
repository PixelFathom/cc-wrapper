"use client"

import { useMemo } from "react"
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
  Clock,
  Activity,
  FileEdit,
  Eye
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import api from "@/lib/api"
import { cn } from "@/lib/utils"
import { motion } from "framer-motion"
import {
  StageSummaryCard,
  StageHooksSection,
  StageMetadata
} from "./shared-stage-components"

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
  const { data: testHooks, refetch: refetchTestHooks, isRefetching: isTestHooksRefetching } = useQuery({
    queryKey: ['test-case-hooks', taskId],
    queryFn: () => api.getTestCaseHooks(taskId),
    refetchInterval: !stageData?.complete ? 3000 : false,
  })

  // Calculate test metrics
  const metrics = useMemo(() => {
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
  }, [testCases])

  // Get test progress
  const progress = useMemo(() => {
    if (stageData?.complete) return 100
    if (!testCases?.test_cases) return 0

    const cases = testCases.test_cases as TestCase[]
    const completed = cases.filter((t: TestCase) =>
      t.status === 'passed' || t.status === 'failed' || t.status === 'skipped'
    ).length

    return cases.length > 0 ? Math.round((completed / cases.length) * 100) : 0
  }, [testCases, stageData])

  // Generate testing summary
  const testingSummary = useMemo(() => {
    if (!testCases?.test_cases || metrics.total === 0) return null

    // Calculate test type counts
    const typeCount = (testCases.test_cases as TestCase[]).reduce((acc: any, t: TestCase) => {
      acc[t.type] = (acc[t.type] || 0) + 1
      return acc
    }, {})

    const testTypesText = Object.entries(typeCount)
      .map(([type, count]) => `- **${type}**: ${count} tests`)
      .join('\n')

    const summary = `# Testing Summary

## Overview

Completed comprehensive testing of the implementation with **${metrics.total} test cases** across multiple categories.

## Results

- **Passed**: ${metrics.passed} tests (${metrics.successRate.toFixed(1)}%)
- **Failed**: ${metrics.failed} tests
- **Pending**: ${metrics.pending} tests

## Test Coverage

${metrics.coverage > 0 ? `Achieved **${metrics.coverage.toFixed(1)}%** code coverage across the implementation.` : 'Code coverage data not available.'}

## Test Types Executed

${testTypesText}

## Status

${metrics.failed === 0 ? '✅ All tests passed successfully. Implementation is verified and ready for deployment.' : `⚠️ ${metrics.failed} test${metrics.failed > 1 ? 's' : ''} failed. Review and fix issues before deployment.`}

---

*Tests executed automatically as part of the issue resolution workflow.*`

    return summary
  }, [testCases, metrics])

  // Transform all hooks for display
  const allHooks = useMemo(() => {
    if (!testHooks?.hooks) return []

    return testHooks.hooks.map((hook: any) => {
      let icon = Activity
      let iconColor = 'text-muted-foreground'
      let bgColor = 'bg-muted'
      let title = hook.message || 'Activity'
      let details: any = {}

      if (hook.tool_name === 'Edit' || hook.tool_name === 'Write') {
        icon = FileEdit
        iconColor = 'text-blue-600'
        bgColor = 'bg-blue-100 dark:bg-blue-900/30'
        title = `${hook.tool_name}: ${hook.tool_input?.file_path?.split('/').pop() || 'file'}`
        details = {
          filePath: hook.tool_input?.file_path,
          oldString: hook.tool_input?.old_string,
          newString: hook.tool_input?.new_string,
        }
      } else if (hook.tool_name === 'Bash') {
        icon = Terminal
        iconColor = 'text-green-600'
        bgColor = 'bg-green-100 dark:bg-green-900/30'
        title = 'Shell Command'
        details = { command: hook.tool_input?.command }
      } else if (hook.tool_name === 'Read') {
        icon = Eye
        iconColor = 'text-purple-600'
        bgColor = 'bg-purple-100 dark:bg-purple-900/30'
        title = `Read: ${hook.tool_input?.file_path?.split('/').pop() || 'file'}`
        details = { filePath: hook.tool_input?.file_path }
      } else if (hook.hook_type === 'test_execution') {
        icon = FlaskConical
        iconColor = 'text-green-600'
        bgColor = 'bg-green-100 dark:bg-green-900/30'
        title = hook.message || 'Test Execution'
        details = { output: hook.data?.output }
      }

      return {
        id: hook.id,
        icon,
        iconColor,
        bgColor,
        title,
        details,
        timestamp: hook.received_at || hook.created_at,
        status: hook.status,
        toolName: hook.tool_name,
        hookType: hook.hook_type,
        message: hook.message,
      }
    }).reverse()
  }, [testHooks])

  // Metadata items
  const metadataItems = useMemo(() => {
    const items = []

    if (stageData?.started_at) {
      items.push({
        label: 'Started',
        value: format(new Date(stageData.started_at), 'MMM d, HH:mm'),
        icon: Clock
      })
    }

    if (stageData?.completed_at) {
      items.push({
        label: 'Completed',
        value: format(new Date(stageData.completed_at), 'MMM d, HH:mm'),
        icon: Clock
      })
    }

    items.push({
      label: 'Total Tests',
      value: metrics.total.toString(),
      icon: CheckSquare
    })

    items.push({
      label: 'Passed',
      value: metrics.passed.toString(),
      icon: CheckCircle
    })

    items.push({
      label: 'Failed',
      value: metrics.failed.toString(),
      icon: XCircle
    })

    items.push({
      label: 'Success Rate',
      value: `${metrics.successRate.toFixed(0)}%`,
      icon: FlaskConical
    })

    return items
  }, [stageData, metrics])

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
    <div className="space-y-6">
      {/* Status Banner */}
      {stageData?.complete ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <Alert className={cn(
            "border-2",
            metrics.failed > 0
              ? "border-amber-500/50 bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 dark:from-amber-950/20 dark:via-yellow-950/20 dark:to-orange-950/20"
              : "border-green-500/50 bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 dark:from-green-950/20 dark:via-emerald-950/20 dark:to-teal-950/20"
          )}>
            {metrics.failed > 0 ? (
              <AlertCircle className="h-5 w-5 text-amber-600" />
            ) : (
              <CheckCircle className="h-5 w-5 text-green-600" />
            )}
            <AlertTitle className="text-lg font-bold">
              {metrics.failed > 0 ? "Testing Complete with Failures" : "All Tests Passed"}
            </AlertTitle>
            <AlertDescription className="mt-3">
              <div className="flex flex-wrap items-center gap-4 text-sm font-medium">
                {stageData?.completed_at && (
                  <span className="flex items-center gap-2 bg-white/60 dark:bg-black/20 px-3 py-1.5 rounded-full">
                    <Clock className="h-4 w-4" />
                    {format(new Date(stageData.completed_at), 'MMM d, HH:mm')}
                  </span>
                )}
                <span className="flex items-center gap-2 bg-white/60 dark:bg-black/20 px-3 py-1.5 rounded-full">
                  <CheckCircle className="h-4 w-4" />
                  {metrics.passed} passed
                </span>
                {metrics.failed > 0 && (
                  <span className="flex items-center gap-2 bg-white/60 dark:bg-black/20 px-3 py-1.5 rounded-full">
                    <XCircle className="h-4 w-4" />
                    {metrics.failed} failed
                  </span>
                )}
              </div>
            </AlertDescription>
          </Alert>
        </motion.div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="pt-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-green-600" />
                  <p className="font-semibold">Testing in Progress</p>
                </div>
                <span className="text-sm font-mono text-muted-foreground">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2.5" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Section */}
      {testingSummary && (
        <StageSummaryCard
          title="Testing Summary"
          description="Comprehensive test results and coverage analysis"
          content={testingSummary}
          icon={FlaskConical}
          accentColor="green"
          badge={`${metrics.successRate.toFixed(0)}% Success`}
        />
      )}

      {/* Test Cases Tab */}
      {testCases?.test_cases && testCases.test_cases.length > 0 && (
        <Tabs defaultValue="tests" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="tests">Test Cases ({metrics.total})</TabsTrigger>
            <TabsTrigger value="failures">Failures ({metrics.failed})</TabsTrigger>
          </TabsList>

          {/* Test Cases Content */}
          <TabsContent value="tests">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">All Test Cases</CardTitle>
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
                <div className="space-y-2 max-h-96 overflow-y-auto">
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
                          {testCase.result && testCase.result.error && (
                            <p className="text-xs text-red-600 font-mono mt-1">
                              {testCase.result.error}
                            </p>
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
              </CardContent>
            </Card>
          </TabsContent>

          {/* Failures Content */}
          <TabsContent value="failures">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Bug className="h-4 w-4" />
                  Failed Tests
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {(testCases.test_cases as TestCase[]).filter(t => t.status === 'failed').length > 0 ? (
                    (testCases.test_cases as TestCase[])
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
                      ))
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8">
                      <CheckCircle className="h-8 w-8 text-green-600 mb-2" />
                      <p className="text-sm text-muted-foreground">No test failures</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* Hooks Section */}
      {allHooks.length > 0 && (
        <StageHooksSection
          hooks={allHooks}
          accentColor="green"
          title="Test Execution Activity"
          description={`Complete test execution log with ${allHooks.length} events`}
          onRefresh={refetchTestHooks}
          isRefreshing={isTestHooksRefetching}
        />
      )}

      {/* Metadata Section */}
      {metadataItems.length > 0 && (
        <StageMetadata
          items={metadataItems}
          title="Testing Metadata"
          accentColor="green"
        />
      )}
    </div>
  )
}
