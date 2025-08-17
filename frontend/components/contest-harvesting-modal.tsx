'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Textarea } from './ui/textarea'
import { Label } from './ui/label'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { ScrollArea } from './ui/scroll-area'
import { Separator } from './ui/separator'
import { Alert, AlertDescription } from './ui/alert'
import { 
  LightningBoltIcon, 
  UpdateIcon, 
  CheckCircledIcon, 
  ChevronRightIcon,
  ChevronLeftIcon,
  QuestionMarkCircledIcon,
  ClockIcon,
  FileTextIcon,
  ChatBubbleIcon,
  Pencil1Icon,
  MagnifyingGlassIcon,
  CrossCircledIcon,
  InfoCircledIcon,
  ExclamationTriangleIcon,
  ListBulletIcon,
  DoubleArrowLeftIcon,
  DoubleArrowRightIcon,
  ArrowTopRightIcon,
  CheckIcon,
  Cross2Icon
} from '@radix-ui/react-icons'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '@/lib/api'

interface ContestHarvestingModalProps {
  taskId: string
  trigger: React.ReactNode
}

interface HarvestingSession {
  id: string
  task_id: string
  total_questions: number
  questions_answered: number
  status: string
  created_at: string
}

interface HarvestingQuestion {
  id: string
  question_text: string
  answer?: string
  category: string
  priority: number
  order: number
  status: string
  answered_at?: string
}

interface SessionData {
  session: HarvestingSession
  questions: HarvestingQuestion[]
}

type ViewMode = 'sessions' | 'active-session' | 'brainstorming' | 'question-navigator' | 'edit-answer'

export function ContestHarvestingModal({ taskId, trigger }: ContestHarvestingModalProps) {
  const [open, setOpen] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('sessions')
  const [loading, setLoading] = useState(false)
  const [sessions, setSessions] = useState<HarvestingSession[]>([])
  const [currentSession, setCurrentSession] = useState<SessionData | null>(null)
  const [currentQuestion, setCurrentQuestion] = useState<HarvestingQuestion | null>(null)
  const [currentAnswer, setCurrentAnswer] = useState('')
  const [contextPrompt, setContextPrompt] = useState('')
  const [editingQuestion, setEditingQuestion] = useState<HarvestingQuestion | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [autoSaveDraft, setAutoSaveDraft] = useState('')
  const [showConfirmDialog, setShowConfirmDialog] = useState<{ action: 'skip' | 'close', question?: HarvestingQuestion } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const draftTimeoutRef = useRef<NodeJS.Timeout>()

  // Load sessions when modal opens
  useEffect(() => {
    if (open) {
      loadSessions()
    }
  }, [open, taskId])

  // Auto-save draft functionality
  useEffect(() => {
    if (currentAnswer && currentQuestion) {
      if (draftTimeoutRef.current) {
        clearTimeout(draftTimeoutRef.current)
      }
      draftTimeoutRef.current = setTimeout(() => {
        setAutoSaveDraft(currentAnswer)
      }, 1000) // Auto-save after 1 second of inactivity
    }
    return () => {
      if (draftTimeoutRef.current) {
        clearTimeout(draftTimeoutRef.current)
      }
    }
  }, [currentAnswer, currentQuestion])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return
      
      if (e.key === 'Escape') {
        if (viewMode === 'active-session' && currentAnswer.trim()) {
          setShowConfirmDialog({ action: 'close' })
        } else {
          setOpen(false)
        }
      }
      
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault()
        if (viewMode === 'sessions' && sessions.length === 0) {
          // Quick start from no-sessions view
          startBrainstorming()
        } else if (currentQuestion && currentAnswer.trim()) {
          if (editingQuestion) {
            updateQuestionAnswer()
          } else {
            answerQuestion()
          }
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, viewMode, currentAnswer, currentQuestion, editingQuestion])

  const clearMessages = () => {
    setError(null)
    setSuccessMessage(null)
  }

  const showError = (message: string) => {
    setError(message)
    setTimeout(() => setError(null), 5000)
  }

  const showSuccess = (message: string) => {
    setSuccessMessage(message)
    setTimeout(() => setSuccessMessage(null), 3000)
  }

  const loadSessions = async () => {
    try {
      clearMessages()
      const response = await api.getContestHarvestingSessions(taskId)
      setSessions(response.sessions)
      
      // Always show sessions view - if no sessions exist, we'll show a streamlined start interface
      setViewMode('sessions')
    } catch (error) {
      console.error('Failed to load contest harvesting sessions:', error)
      showError('Failed to load sessions. Please try again.')
      setViewMode('sessions')
    }
  }

  const startBrainstorming = async () => {
    setLoading(true)
    setViewMode('brainstorming')
    clearMessages()
    try {
      const response = await api.startContestHarvesting(taskId, {
        context_prompt: contextPrompt || undefined
      })
      
      // Wait a moment for the agent to process
      setTimeout(() => {
        loadSessionAndStartQuestioning(response.session_id)
      }, 2000)
      
    } catch (error) {
      console.error('Failed to start contest harvesting:', error)
      showError('Failed to start brainstorming session. Please try again.')
      setLoading(false)
      setViewMode('sessions')
    }
  }

  const loadSessionAndStartQuestioning = async (sessionId: string) => {
    try {
      const sessionData = await api.getContestHarvestingSession(sessionId)
      setCurrentSession(sessionData)
      
      // Get current question
      const questionResponse = await api.getCurrentQuestion(sessionId)
      if (questionResponse.question) {
        setCurrentQuestion(questionResponse.question)
        setViewMode('active-session')
      }
      
    } catch (error) {
      console.error('Failed to load session:', error)
      showError('Failed to load session questions.')
    } finally {
      setLoading(false)
    }
  }

  const loadSession = async (sessionId: string) => {
    setLoading(true)
    clearMessages()
    try {
      const sessionData = await api.getContestHarvestingSession(sessionId)
      setCurrentSession(sessionData)
      
      // Get current question
      const questionResponse = await api.getCurrentQuestion(sessionId)
      setCurrentQuestion(questionResponse.question || null)
      setViewMode('active-session')
      
    } catch (error) {
      console.error('Failed to load session:', error)
      showError('Failed to load session.')
    } finally {
      setLoading(false)
    }
  }

  const answerQuestion = async () => {
    if (!currentQuestion || !currentAnswer.trim()) return
    
    setLoading(true)
    clearMessages()
    try {
      const response = await api.answerContestHarvestingQuestion(currentQuestion.id, {
        answer: currentAnswer
      })
      
      setCurrentAnswer('')
      setAutoSaveDraft('')
      setCurrentQuestion(response.next_question || null)
      showSuccess('Answer submitted successfully!')
      
      // Reload session data to update progress
      if (currentSession) {
        const sessionData = await api.getContestHarvestingSession(currentSession.session.id)
        setCurrentSession(sessionData)
      }
      
    } catch (error) {
      console.error('Failed to answer question:', error)
      showError('Failed to submit answer. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const updateQuestionAnswer = async () => {
    if (!editingQuestion || !currentAnswer.trim()) return
    
    setLoading(true)
    clearMessages()
    try {
      const response = await api.answerContestHarvestingQuestion(editingQuestion.id, {
        answer: currentAnswer
      })
      
      setCurrentAnswer('')
      setEditingQuestion(null)
      setViewMode('active-session')
      showSuccess('Answer updated successfully!')
      
      // Reload session data to update progress
      if (currentSession) {
        const sessionData = await api.getContestHarvestingSession(currentSession.session.id)
        setCurrentSession(sessionData)
      }
      
    } catch (error) {
      console.error('Failed to update answer:', error)
      showError('Failed to update answer. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const skipQuestion = async () => {
    if (!currentQuestion) return
    
    setLoading(true)
    clearMessages()
    try {
      const response = await api.skipContestHarvestingQuestion(currentQuestion.id)
      setCurrentQuestion(response.next_question || null)
      showSuccess('Question skipped.')
      
      // Reload session data to update progress
      if (currentSession) {
        const sessionData = await api.getContestHarvestingSession(currentSession.session.id)
        setCurrentSession(sessionData)
      }
      
    } catch (error) {
      console.error('Failed to skip question:', error)
      showError('Failed to skip question. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleSkipWithConfirmation = () => {
    if (currentQuestion) {
      setShowConfirmDialog({ action: 'skip', question: currentQuestion })
    }
  }

  const confirmAction = () => {
    if (showConfirmDialog?.action === 'skip') {
      skipQuestion()
    } else if (showConfirmDialog?.action === 'close') {
      setOpen(false)
    }
    setShowConfirmDialog(null)
  }

  const navigateToQuestion = (question: HarvestingQuestion) => {
    if (question.answer) {
      // Edit mode for answered questions
      setEditingQuestion(question)
      setCurrentAnswer(question.answer)
      setViewMode('edit-answer')
    } else {
      // Navigate to unanswered question
      setCurrentQuestion(question)
      setCurrentAnswer('')
      setViewMode('active-session')
    }
  }

  const navigateToPreviousQuestion = () => {
    if (!currentSession || !currentQuestion) return
    
    const currentIndex = currentSession.questions.findIndex(q => q.id === currentQuestion.id)
    if (currentIndex > 0) {
      const prevQuestion = currentSession.questions[currentIndex - 1]
      navigateToQuestion(prevQuestion)
    }
  }

  const navigateToNextQuestion = () => {
    if (!currentSession || !currentQuestion) return
    
    const currentIndex = currentSession.questions.findIndex(q => q.id === currentQuestion.id)
    if (currentIndex < currentSession.questions.length - 1) {
      const nextQuestion = currentSession.questions[currentIndex + 1]
      navigateToQuestion(nextQuestion)
    }
  }

  const resetModal = () => {
    setViewMode('sessions')
    setCurrentSession(null)
    setCurrentQuestion(null)
    setCurrentAnswer('')
    setContextPrompt('')
    setEditingQuestion(null)
    setSearchQuery('')
    setSelectedCategory('all')
    setAutoSaveDraft('')
    setShowConfirmDialog(null)
    clearMessages()
    setLoading(false)
  }

  const getCategoryColor = (category: string) => {
    const colors = {
      business: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      technical: 'bg-green-500/20 text-green-400 border-green-500/30',
      ux: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      performance: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      integration: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      testing: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
      security: 'bg-red-500/20 text-red-400 border-red-500/30',
      deployment: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
    }
    return colors[category as keyof typeof colors] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'
  }

  const getUniqueCategories = () => {
    if (!currentSession) return []
    const categories = Array.from(new Set(currentSession.questions.map(q => q.category)))
    return categories.sort()
  }

  const filteredQuestions = currentSession?.questions.filter(question => {
    const matchesSearch = searchQuery === '' || 
      question.question_text.toLowerCase().includes(searchQuery.toLowerCase()) ||
      question.answer?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = selectedCategory === 'all' || question.category === selectedCategory
    return matchesSearch && matchesCategory
  }) || []

  const getQuestionPosition = () => {
    if (!currentSession || !currentQuestion) return { current: 0, total: 0 }
    const currentIndex = currentSession.questions.findIndex(q => q.id === currentQuestion.id)
    return { current: currentIndex + 1, total: currentSession.questions.length }
  }

  const completionPercentage = currentSession 
    ? Math.round((currentSession.session.questions_answered / currentSession.session.total_questions) * 100)
    : 0

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) {
        if (viewMode === 'active-session' && currentAnswer.trim()) {
          setShowConfirmDialog({ action: 'close' })
          return
        }
        resetModal()
      }
      setOpen(isOpen)
    }}>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="w-[96vw] max-w-5xl max-h-[96vh] sm:max-h-[92vh] overflow-hidden mx-auto p-4 sm:p-6">
        <DialogHeader className="space-y-3 pb-3 border-b border-border/30">
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl font-semibold">
            <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 p-2 rounded-lg border border-purple-500/30">
              <LightningBoltIcon className="h-4 w-4 sm:h-5 sm:w-5 text-purple-400" />
            </div>
            <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Context Harvesting
            </span>
            {viewMode === 'active-session' && currentQuestion && (
              <Badge variant="outline" className="ml-auto">
                Question {getQuestionPosition().current} of {getQuestionPosition().total}
              </Badge>
            )}
          </DialogTitle>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
            Gather valuable context about your project through intelligent questioning
          </p>
        </DialogHeader>

        {/* Error and Success Messages */}
        {error && (
          <Alert variant="destructive" className="mx-4 sm:mx-6">
            <ExclamationTriangleIcon className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {successMessage && (
          <Alert className="mx-4 sm:mx-6 border-green-500/30 bg-green-500/10">
            <CheckCircledIcon className="h-4 w-4 text-green-400" />
            <AlertDescription className="text-green-400">{successMessage}</AlertDescription>
          </Alert>
        )}

        <ScrollArea className="h-[calc(96vh-200px)] sm:h-[calc(92vh-200px)]">
          <div className="space-y-6 p-4 sm:p-6 pt-2">
            <AnimatePresence mode="wait">

              {/* Brainstorming View */}
              {viewMode === 'brainstorming' && (
                <motion.div
                  key="brainstorming"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="text-center space-y-6 py-12"
                >
                  <div className="bg-gradient-to-br from-purple-500/20 via-blue-500/20 to-pink-500/20 rounded-full w-24 h-24 mx-auto flex items-center justify-center border border-purple-500/30">
                    <UpdateIcon className="h-12 w-12 text-purple-400 animate-spin" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                      AI is Analyzing Your Project
                    </h3>
                    <p className="text-muted-foreground">
                      Generating intelligent questions to gather context...
                    </p>
                  </div>
                </motion.div>
              )}

              {/* Sessions List View */}
              {viewMode === 'sessions' && (
                <motion.div
                  key="sessions"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-4"
                >
                  {sessions.length > 0 ? (
                    <>
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold">Your Context Harvesting Sessions</h3>
                      </div>
                      
                      {/* Quick Start Section for New Session */}
                      <Card className="border-dashed border-purple-500/30 bg-gradient-to-r from-purple-500/5 to-pink-500/5">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="space-y-1">
                              <h4 className="font-medium text-purple-400">Start New Session</h4>
                              <p className="text-sm text-muted-foreground">
                                Launch a new context harvesting session with AI-generated questions
                              </p>
                            </div>
                            <div className="space-y-2">
                              <Button
                                onClick={startBrainstorming}
                                disabled={loading}
                                size="sm"
                                className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white border-0 font-medium"
                              >
                                {loading ? (
                                  <>
                                    <UpdateIcon className="h-4 w-4 mr-2 animate-spin" />
                                    Starting...
                                  </>
                                ) : (
                                  <>
                                    <LightningBoltIcon className="h-4 w-4 mr-2" />
                                    Quick Start
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                          
                          {/* Optional Context Input - Collapsed by default */}
                          {contextPrompt !== '' && (
                            <div className="mt-4 pt-4 border-t border-border/30">
                              <Label htmlFor="context-prompt" className="text-sm font-medium text-muted-foreground mb-2 block">
                                Additional Context (Optional)
                              </Label>
                              <Textarea
                                id="context-prompt"
                                placeholder="Provide specific areas you'd like the AI to focus on..."
                                value={contextPrompt}
                                onChange={(e) => setContextPrompt(e.target.value)}
                                className="min-h-[80px] resize-none text-sm"
                              />
                            </div>
                          )}
                          
                          {/* Show context input option if not already shown */}
                          {contextPrompt === '' && (
                            <div className="mt-3 pt-3 border-t border-border/30">
                              <Button
                                onClick={() => setContextPrompt(' ')} // Set to space to trigger visibility
                                variant="ghost"
                                size="sm"
                                className="text-xs text-muted-foreground hover:text-purple-400"
                              >
                                <Pencil1Icon className="h-3 w-3 mr-1" />
                                Add specific context (optional)
                              </Button>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                      
                      {/* Previous Sessions */}
                      <div className="space-y-3">
                        <h4 className="text-sm font-medium text-muted-foreground">Previous Sessions</h4>
                        {sessions.map((session) => {
                          const sessionCompletionPercentage = Math.round((session.questions_answered / session.total_questions) * 100)
                          return (
                            <Card key={session.id} className="hover:shadow-lg transition-all duration-200 cursor-pointer border-l-4 border-l-purple-500/50">
                              <CardContent 
                                className="p-4"
                                onClick={() => loadSession(session.id)}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                      <ClockIcon className="h-4 w-4 text-muted-foreground" />
                                      <span className="text-sm text-muted-foreground">
                                        {new Date(session.created_at).toLocaleDateString()} at {new Date(session.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <span className="text-sm font-medium">
                                        {session.questions_answered} / {session.total_questions} questions answered
                                      </span>
                                      <Badge 
                                        className={sessionCompletionPercentage === 100 ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-blue-500/20 text-blue-400 border-blue-500/30'}
                                      >
                                        {sessionCompletionPercentage}% complete
                                      </Badge>
                                      {session.status === 'completed' && (
                                        <CheckCircledIcon className="h-4 w-4 text-green-400" />
                                      )}
                                    </div>
                                    <div className="w-48 bg-black/20 rounded-full h-1.5">
                                      <div 
                                        className="bg-gradient-to-r from-purple-500 to-pink-500 h-1.5 rounded-full transition-all duration-300"
                                        style={{ width: `${sessionCompletionPercentage}%` }}
                                      />
                                    </div>
                                  </div>
                                  <ChevronRightIcon className="h-5 w-5 text-muted-foreground" />
                                </div>
                              </CardContent>
                            </Card>
                          )
                        })}
                      </div>
                    </>
                  ) : (
                    /* No Sessions - Streamlined Start Interface */
                    <div className="space-y-6">
                      <div className="text-center space-y-4">
                        <div className="bg-gradient-to-br from-purple-500/20 via-blue-500/20 to-pink-500/20 rounded-full w-20 h-20 mx-auto flex items-center justify-center border border-purple-500/30">
                          <LightningBoltIcon className="h-10 w-10 text-purple-400" />
                        </div>
                        <h3 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                          Ready to Start Context Harvesting?
                        </h3>
                        <p className="text-muted-foreground max-w-md mx-auto">
                          Our AI will analyze your project and generate intelligent questions to gather comprehensive context.
                        </p>
                      </div>

                      <div className="space-y-4">
                        <Label htmlFor="context-prompt-new" className="text-sm font-medium">
                          Additional Context (Optional)
                        </Label>
                        <Textarea
                          id="context-prompt-new"
                          placeholder="Provide any specific areas you'd like the AI to focus on when generating questions..."
                          value={contextPrompt}
                          onChange={(e) => setContextPrompt(e.target.value)}
                          className="min-h-[100px] resize-none"
                        />
                        <p className="text-xs text-muted-foreground">
                          Press Ctrl+Enter to quickly start context harvesting
                        </p>
                      </div>

                      <Button
                        onClick={startBrainstorming}
                        disabled={loading}
                        className="w-full h-12 bg-gradient-to-r from-purple-500 via-blue-500 to-pink-500 hover:from-purple-600 hover:via-blue-600 hover:to-pink-600 text-white border-0 font-semibold shadow-lg"
                      >
                        {loading ? (
                          <>
                            <UpdateIcon className="h-5 w-5 mr-2 animate-spin" />
                            Starting Context Harvesting...
                          </>
                        ) : (
                          <>
                            <LightningBoltIcon className="h-5 w-5 mr-2" />
                            Start Context Harvesting
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </motion.div>
              )}

              {/* Active Session View */}
              {viewMode === 'active-session' && currentSession && (
                <motion.div
                  key="active-session"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-6"
                >
                  {/* Enhanced Progress Header */}
                  <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-lg p-4 border border-purple-500/20">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-4">
                        <h3 className="font-semibold">Session Progress</h3>
                        <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                          {completionPercentage}% Complete
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={() => setViewMode('question-navigator')}
                          variant="ghost"
                          size="sm"
                        >
                          <ListBulletIcon className="h-4 w-4 mr-1" />
                          All Questions
                        </Button>
                        <Button
                          onClick={() => setViewMode('sessions')}
                          variant="ghost"
                          size="sm"
                        >
                          <ChevronLeftIcon className="h-4 w-4 mr-1" />
                          Back to Sessions
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Questions Answered</span>
                        <span>{currentSession.session.questions_answered} / {currentSession.session.total_questions}</span>
                      </div>
                      <div className="w-full bg-black/20 rounded-full h-2">
                        <div 
                          className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${completionPercentage}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Current Question */}
                  {currentQuestion ? (
                    <Card className="border-purple-500/30 bg-gradient-to-br from-card/80 to-card">
                      <CardHeader className="space-y-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="flex items-center gap-2 text-lg">
                            <QuestionMarkCircledIcon className="h-5 w-5 text-purple-400" />
                            Question {currentQuestion.order}
                          </CardTitle>
                          <Badge className={getCategoryColor(currentQuestion.category)}>
                            {currentQuestion.category}
                          </Badge>
                        </div>
                        
                        {/* Navigation buttons */}
                        <div className="flex items-center justify-between">
                          <Button
                            onClick={navigateToPreviousQuestion}
                            disabled={!currentSession.questions.find(q => q.order < currentQuestion.order)}
                            variant="outline"
                            size="sm"
                          >
                            <ChevronLeftIcon className="h-4 w-4 mr-1" />
                            Previous
                          </Button>
                          <Button
                            onClick={navigateToNextQuestion}
                            disabled={!currentSession.questions.find(q => q.order > currentQuestion.order)}
                            variant="outline"
                            size="sm"
                          >
                            Next
                            <ChevronRightIcon className="h-4 w-4 ml-1" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <p className="text-lg leading-relaxed">{currentQuestion.question_text}</p>
                        
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="answer" className="text-sm font-medium">
                              Your Answer
                            </Label>
                            {autoSaveDraft && autoSaveDraft !== currentAnswer && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <InfoCircledIcon className="h-3 w-3" />
                                Draft auto-saved
                              </span>
                            )}
                          </div>
                          <Textarea
                            ref={textareaRef}
                            id="answer"
                            placeholder="Share your thoughts and insights..."
                            value={currentAnswer}
                            onChange={(e) => setCurrentAnswer(e.target.value)}
                            className="min-h-[120px] resize-none"
                          />
                          <p className="text-xs text-muted-foreground">
                            Press Ctrl+Enter to submit • Esc to close
                          </p>
                        </div>
                        
                        <div className="flex gap-3">
                          <Button
                            onClick={answerQuestion}
                            disabled={loading || !currentAnswer.trim()}
                            className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                          >
                            {loading ? (
                              <>
                                <UpdateIcon className="h-4 w-4 mr-2 animate-spin" />
                                Submitting...
                              </>
                            ) : (
                              <>
                                <CheckCircledIcon className="h-4 w-4 mr-2" />
                                Submit Answer
                              </>
                            )}
                          </Button>
                          
                          <Button
                            onClick={handleSkipWithConfirmation}
                            disabled={loading}
                            variant="outline"
                            className="flex-1"
                          >
                            <ChevronRightIcon className="h-4 w-4 mr-2" />
                            Skip Question
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="text-center space-y-4 py-12">
                      <div className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-full w-20 h-20 mx-auto flex items-center justify-center border border-green-500/30">
                        <CheckCircledIcon className="h-10 w-10 text-green-400" />
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-xl font-bold text-green-400">
                          Session Complete!
                        </h3>
                        <p className="text-muted-foreground">
                          You've answered all questions in this session. Great job!
                        </p>
                      </div>
                      <div className="flex gap-3 justify-center">
                        <Button
                          onClick={() => setViewMode('question-navigator')}
                          className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
                        >
                          <ListBulletIcon className="h-4 w-4 mr-2" />
                          Review Answers
                        </Button>
                        <Button
                          onClick={() => setViewMode('sessions')}
                          variant="outline"
                        >
                          <ChevronLeftIcon className="h-4 w-4 mr-2" />
                          Back to Sessions
                        </Button>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {/* Question Navigator View */}
              {viewMode === 'question-navigator' && currentSession && (
                <motion.div
                  key="question-navigator"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Question Navigator</h3>
                    <Button
                      onClick={() => setViewMode('active-session')}
                      variant="ghost"
                      size="sm"
                    >
                      <ChevronLeftIcon className="h-4 w-4 mr-1" />
                      Back to Current Question
                    </Button>
                  </div>

                  {/* Search and Filter */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="relative">
                      <MagnifyingGlassIcon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search questions or answers..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => setSelectedCategory('all')}
                        variant={selectedCategory === 'all' ? 'default' : 'outline'}
                        size="sm"
                      >
                        All Categories
                      </Button>
                      {getUniqueCategories().slice(0, 3).map(category => (
                        <Button
                          key={category}
                          onClick={() => setSelectedCategory(category)}
                          variant={selectedCategory === category ? 'default' : 'outline'}
                          size="sm"
                          className="capitalize"
                        >
                          {category}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Questions List */}
                  <div className="space-y-3">
                    {filteredQuestions.map((question) => (
                      <Card
                        key={question.id}
                        className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${
                          question.answer 
                            ? 'border-l-4 border-l-green-500/50 bg-green-500/5' 
                            : 'border-l-4 border-l-orange-500/50 bg-orange-500/5'
                        }`}
                        onClick={() => navigateToQuestion(question)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 space-y-2">
                              <div className="flex items-center gap-2">
                                <Badge className={getCategoryColor(question.category)}>
                                  {question.category}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  Question {question.order}
                                </span>
                                {question.answer ? (
                                  <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                                    <CheckIcon className="h-3 w-3 mr-1" />
                                    Answered
                                  </Badge>
                                ) : (
                                  <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">
                                    Pending
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm font-medium">{question.question_text}</p>
                              {question.answer && (
                                <p className="text-xs text-muted-foreground line-clamp-2">
                                  {question.answer}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {question.answer && (
                                <Button size="sm" variant="ghost">
                                  <Pencil1Icon className="h-3 w-3 mr-1" />
                                  Edit
                                </Button>
                              )}
                              <ChevronRightIcon className="h-4 w-4 text-muted-foreground" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {filteredQuestions.length === 0 && (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">No questions match your search criteria.</p>
                    </div>
                  )}
                </motion.div>
              )}

              {/* Edit Answer View */}
              {viewMode === 'edit-answer' && editingQuestion && (
                <motion.div
                  key="edit-answer"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-6"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Edit Answer</h3>
                    <Button
                      onClick={() => {
                        setEditingQuestion(null)
                        setCurrentAnswer('')
                        setViewMode('question-navigator')
                      }}
                      variant="ghost"
                      size="sm"
                    >
                      <ChevronLeftIcon className="h-4 w-4 mr-1" />
                      Back to Navigator
                    </Button>
                  </div>

                  <Card className="border-blue-500/30 bg-gradient-to-br from-card/80 to-card">
                    <CardHeader className="space-y-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <Pencil1Icon className="h-5 w-5 text-blue-400" />
                          Question {editingQuestion.order}
                        </CardTitle>
                        <Badge className={getCategoryColor(editingQuestion.category)}>
                          {editingQuestion.category}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="bg-muted/50 rounded-lg p-4">
                        <p className="text-lg leading-relaxed">{editingQuestion.question_text}</p>
                      </div>
                      
                      <div className="space-y-3">
                        <Label htmlFor="edit-answer" className="text-sm font-medium">
                          Update Your Answer
                        </Label>
                        <Textarea
                          id="edit-answer"
                          placeholder="Update your thoughts and insights..."
                          value={currentAnswer}
                          onChange={(e) => setCurrentAnswer(e.target.value)}
                          className="min-h-[120px] resize-none"
                        />
                        <p className="text-xs text-muted-foreground">
                          Press Ctrl+Enter to save changes • Esc to cancel
                        </p>
                      </div>
                      
                      <div className="flex gap-3">
                        <Button
                          onClick={updateQuestionAnswer}
                          disabled={loading || !currentAnswer.trim()}
                          className="flex-1 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600"
                        >
                          {loading ? (
                            <>
                              <UpdateIcon className="h-4 w-4 mr-2 animate-spin" />
                              Updating...
                            </>
                          ) : (
                            <>
                              <CheckCircledIcon className="h-4 w-4 mr-2" />
                              Update Answer
                            </>
                          )}
                        </Button>
                        
                        <Button
                          onClick={() => {
                            setEditingQuestion(null)
                            setCurrentAnswer('')
                            setViewMode('question-navigator')
                          }}
                          variant="outline"
                          className="flex-1"
                        >
                          <Cross2Icon className="h-4 w-4 mr-2" />
                          Cancel
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </ScrollArea>

        {/* Confirmation Dialog */}
        {showConfirmDialog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-card border rounded-lg p-6 max-w-md mx-4"
            >
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <ExclamationTriangleIcon className="h-5 w-5 text-orange-400" />
                  <h4 className="font-semibold">
                    {showConfirmDialog.action === 'skip' ? 'Skip Question?' : 'Close Modal?'}
                  </h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  {showConfirmDialog.action === 'skip' 
                    ? 'Are you sure you want to skip this question? You can always come back to it later.'
                    : 'You have unsaved changes. Are you sure you want to close?'
                  }
                </p>
                <div className="flex gap-3">
                  <Button
                    onClick={confirmAction}
                    variant="destructive"
                    className="flex-1"
                  >
                    {showConfirmDialog.action === 'skip' ? 'Skip Question' : 'Close'}
                  </Button>
                  <Button
                    onClick={() => setShowConfirmDialog(null)}
                    variant="outline"
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}