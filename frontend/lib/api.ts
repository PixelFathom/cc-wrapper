const getApiBaseUrl = () => {
  // Client-side: Use environment variable or fallback
  if (typeof window !== 'undefined') {
    return process.env.NEXT_PUBLIC_BACKEND_HOST || 'http://localhost:8000';
  }
  // Server-side: Use backend service name for container-to-container communication
  return process.env.BACKEND_HOST || 'http://localhost:8000';
};

const API_BASE_URL = getApiBaseUrl()

export interface Project {
  id: string
  name: string
  repo_url: string
  created_at: string
  tasks?: Task[]
}

export interface Task {
  id: string
  project_id: string
  name: string
  created_at: string
  mcp_servers?: Array<{
    server_type: string
    access_token?: string
    server_name?: string
    url?: string
  }>
  deployment_status: 'pending' | 'initializing' | 'deploying' | 'completed' | 'failed'
  deployment_request_id?: string
  deployment_completed: boolean
  deployment_started_at?: string
  deployment_completed_at?: string
}

export interface DeploymentHook {
  id: string
  task_id: string
  session_id: string
  hook_type: string
  status: string
  data: any
  message?: string
  is_complete: boolean
  received_at: string
}

export interface DeploymentHooksResponse {
  task_id: string
  deployment_status: string
  deployment_completed: boolean
  hooks: DeploymentHook[]
}

export interface SubProject {
  id: string
  task_id: string
  created_at: string
}

export interface Chat {
  id: string
  sub_project_id: string
  session_id: string
  role: 'user' | 'assistant' | 'hook' | 'auto'
  content: any
  created_at: string
  continuation_status?: 'none' | 'needed' | 'in_progress' | 'completed'
  parent_message_id?: string
}

export interface ChatHook {
  id: string
  hook_type: string
  status: string
  message?: string
  data: any
  is_complete: boolean
  received_at: string
  step_name?: string
  step_index?: number
  total_steps?: number
  message_type?: string
  content_type?: string
  tool_name?: string
  tool_input?: any
  conversation_id?: string
}

export interface ChatHooksResponse {
  chat_id: string
  session_id?: string
  hooks: ChatHook[]
}

export interface Approval {
  id: string
  sub_project_id: string
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  
  // Common fields based on type
  type: 'regular' | 'mcp'
  
  // Regular approval fields
  prompt?: string
  response?: string
  responded_at?: string
  action_type?: string
  details?: string
  cwd?: string
  
  // MCP approval fields
  request_id?: string
  tool_name?: string
  tool_input?: any
  display_text?: string
}

export interface TestCase {
  id: string
  title: string
  description?: string
  test_steps: string
  expected_result: string
  status: 'pending' | 'running' | 'passed' | 'failed'
  last_execution_at?: string
  execution_result?: string
  task_id: string
  created_at: string
  source?: 'manual' | 'ai_generated'
  session_id?: string
  generated_from_messages?: string
  ai_model_used?: string
}

interface ExtendedApiClient {
  getSessionChats: (sessionId: string) => Promise<{ messages: Chat[] }>
  getSubProjectSessions: (subProjectId: string) => Promise<{ sessions: any[] }>
  getMessageHooks: (messageId: string) => Promise<{ hooks: ChatHook[] }>
  getMCPApprovals: (params?: { cwd?: string; sub_project_id?: string }) => Promise<Approval[]>
  continueChat: (chatId: string) => Promise<{
    needs_continuation: boolean
    auto_message_id?: string
    continuation_prompt?: string
    reasoning?: string
  }>
  toggleAutoContinuation: (sessionId: string, enabled: boolean) => Promise<{
    session_id: string
    auto_continuation_enabled: boolean
    updated_count: number
  }>
  toggleBypassMode: (sessionId: string, enabled: boolean) => Promise<{
    session_id: string
    bypass_mode_enabled: boolean
    updated_count: number
  }>
  // Contest Harvesting methods
  startContestHarvesting: (taskId: string, data?: { context_prompt?: string }) => Promise<{
    session_id: string
    total_questions: number
    message: string
  }>
  getContestHarvestingSessions: (taskId: string) => Promise<{
    sessions: Array<{
      id: string
      task_id: string
      total_questions: number
      questions_answered: number
      status: string
      created_at: string
    }>
    total_sessions: number
  }>
  getContestHarvestingSession: (sessionId: string) => Promise<{
    session: {
      id: string
      task_id: string
      total_questions: number
      questions_answered: number
      status: string
      created_at: string
    }
    questions: Array<{
      id: string
      question_text: string
      answer?: string
      category: string
      priority: number
      order: number
      status: string
      answered_at?: string
    }>
  }>
  getCurrentQuestion: (sessionId: string) => Promise<{
    question?: {
      id: string
      question_text: string
      category: string
      priority: number
      order: number
      status: string
    }
    message?: string
  }>
  answerContestHarvestingQuestion: (questionId: string, data: { answer: string }) => Promise<{
    success: boolean
    message: string
    next_question?: {
      id: string
      question_text: string
      category: string
      priority: number
      order: number
      status: string
    }
  }>
  skipContestHarvestingQuestion: (questionId: string, reason?: string) => Promise<{
    success: boolean
    message: string
    next_question?: {
      id: string
      question_text: string
      category: string
      priority: number
      order: number
      status: string
    }
  }>
}

class ApiClient {
  private baseUrl: string

  constructor() {
    this.baseUrl = `${API_BASE_URL}/api`
  }

  /**
   * Get authentication headers from stored user
   */
  private getAuthHeaders(): HeadersInit {
    const storedUser = typeof window !== 'undefined' ? localStorage.getItem('github_user') : null
    if (!storedUser) {
      throw new Error('User not authenticated. Please log in with GitHub.')
    }

    try {
      const user = JSON.parse(storedUser)
      if (!user.id) {
        throw new Error('Invalid user data. Please re-authenticate.')
      }

      return {
        'Content-Type': 'application/json',
        'X-User-ID': user.id,
      }
    } catch (e) {
      throw new Error('Failed to parse user data. Please re-authenticate.')
    }
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    })

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`)
    }

    return response.json()
  }

  private async authenticatedRequest<T>(path: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        ...this.getAuthHeaders(),
        ...options?.headers,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`API error (${response.status}): ${errorText}`)
    }

    return response.json()
  }

  // Projects (all require authentication)
  getProjects = async (): Promise<Project[]> => {
    return this.authenticatedRequest('/projects')
  }

  createProject = async (data: { name: string; repo_url: string }): Promise<Project> => {
    return this.authenticatedRequest('/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  getProject = async (id: string): Promise<Project> => {
    return this.authenticatedRequest(`/projects/${id}`)
  }

  deleteProject = async (id: string): Promise<void> => {
    await this.authenticatedRequest(`/projects/${id}`, {
      method: 'DELETE',
    })
  }

  // Tasks (all require authentication)
  getTasks = async (projectId: string): Promise<Task[]> => {
    return this.authenticatedRequest(`/projects/${projectId}/tasks`)
  }

  createTask = async (data: {
    name: string;
    project_id: string;
    mcp_servers?: Array<{
      server_type: string;
      access_token?: string;
      server_name?: string;
      url?: string;
    }>
  }): Promise<Task> => {
    return this.authenticatedRequest('/tasks', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  getTask = async (id: string): Promise<Task> => {
    return this.authenticatedRequest(`/tasks/${id}`)
  }

  getTaskSubProjects = async (taskId: string): Promise<{ task_id: string; sub_projects: Array<{ id: string; created_at: string }> }> => {
    return this.authenticatedRequest(`/tasks/${taskId}/sub-projects`)
  }

  // Chat (all require authentication)
  sendQuery = async (data: {
    prompt: string
    session_id?: string
    org_name: string
    cwd: string
    webhook_url?: string
    bypass_mode?: boolean
    permission_mode?: 'interactive' | 'bypassPermissions' | 'plan'
    agent_name?: string | null
  }): Promise<{ session_id: string; assistant_response: string; chat_id?: string }> => {
    return this.authenticatedRequest('/query', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  // Chat with hooks
  sendChatQuery = async (chatId: string, data: {
    prompt: string
    session_id?: string
  }): Promise<{ session_id: string; assistant_response: string }> => {
    return this.authenticatedRequest(`/chats/${chatId}/query`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  getChatHooks = async (chatId: string, sessionId?: string, limit: number = 50): Promise<ChatHooksResponse> => {
    const params = new URLSearchParams()
    if (sessionId) params.append('session_id', sessionId)
    params.append('limit', limit.toString())

    const queryString = params.toString()
    return this.authenticatedRequest(`/chats/${chatId}/hooks${queryString ? `?${queryString}` : ''}`)
  }

  getMessageHooks = async (messageId: string, limit: number = 50): Promise<ChatHooksResponse> => {
    const params = new URLSearchParams()
    params.append('limit', limit.toString())

    const queryString = params.toString()
    return this.authenticatedRequest(`/messages/${messageId}/hooks${queryString ? `?${queryString}` : ''}`)
  }

  // Approvals (requires authentication)
  getPendingApprovals = async (params?: { cwd?: string; sub_project_id?: string }): Promise<Approval[]> => {
    const queryParams = new URLSearchParams()
    if (params?.cwd) queryParams.append('cwd', params.cwd)
    if (params?.sub_project_id) queryParams.append('sub_project_id', params.sub_project_id)

    const queryString = queryParams.toString()
    return this.authenticatedRequest(`/approvals/pending${queryString ? `?${queryString}` : ''}`)
  }

  submitApprovalResult = async (data: {
    approval_id: string
    decision: string
    comment?: string
  }): Promise<{ message: string }> => {
    return this.authenticatedRequest('/approvals/result', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  // File upload
  uploadFile = async (file: File, orgName: string, cwd: string, remotePath?: string): Promise<any> => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('org_name', orgName)
    formData.append('cwd', cwd)
    if (remotePath) {
      formData.append('remote_path', remotePath)
    }

    const response = await fetch(`${this.baseUrl}/upload_file`, {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      throw new Error(`Upload error: ${response.statusText}`)
    }

    return response.json()
  }

  // SSE for chat streaming
  getEventSource = (sessionId: string): EventSource => {
    return new EventSource(`${this.baseUrl}/stream/${sessionId}`)
  }

  // Deployment (all require authentication)
  getTaskDeploymentHooks = async (taskId: string, limit: number = 20): Promise<DeploymentHooksResponse> => {
    return this.authenticatedRequest(`/tasks/${taskId}/deployment-hooks?limit=${limit}`)
  }

  retryTaskDeployment = async (taskId: string): Promise<{ status: string; request_id?: string }> => {
    return this.authenticatedRequest(`/tasks/${taskId}/retry-deployment`, {
      method: 'POST',
    })
  }

  // VS Code (requires authentication)
  getTaskVSCodeLink = async (taskId: string, filePath?: string): Promise<{ tunnel_link: string; tunnel_name: string }> => {
    const queryParams = filePath ? `?file_path=${encodeURIComponent(filePath)}` : ''
    return this.authenticatedRequest(`/tasks/${taskId}/vscode-link${queryParams}`)
  }

  // Knowledge Base
  uploadToKnowledgeBase = async (taskId: string, file: File, filePath?: string): Promise<{
    id: string
    file_name: string
    file_path: string
    size_bytes: number
    content_type: string | null
    uploaded_at: string
    status: string
    message: string
  }> => {
    const formData = new FormData()
    formData.append('file', file)
    if (filePath) {
      formData.append('file_path', filePath)
    }

    // Get auth headers (but don't set Content-Type for FormData)
    const authHeaders = this.getAuthHeaders()

    const response = await fetch(`${this.baseUrl}/tasks/${taskId}/knowledge-base/upload`, {
      method: 'POST',
      headers: {
        'X-User-ID': authHeaders['X-User-ID'] as string,
      },
      body: formData,
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Knowledge Base upload error (${response.status}): ${errorText}`)
    }

    return response.json()
  }

  getKnowledgeBaseFiles = async (taskId: string): Promise<{
    files: Array<{
      id: string
      file_name: string
      file_path: string
      size_bytes: number
      content_type: string | null
      uploaded_at: string
    }>
    total_files: number
  }> => {
    return this.authenticatedRequest(`/tasks/${taskId}/knowledge-base/files`)
  }

  // Test Cases (all require authentication)
  getTestCases = async (taskId: string): Promise<TestCase[]> => {
    return this.authenticatedRequest(`/tasks/${taskId}/test-cases`)
  }

  getTestCasesGrouped = async (taskId: string): Promise<{
    task_id: string
    total_test_cases: number
    session_count: number
    sessions: Array<{
      session_id: string
      display_name: string
      test_case_count: number
      test_cases: TestCase[]
      is_ai_generated: boolean
      latest_execution: string | null
    }>
  }> => {
    return this.authenticatedRequest(`/tasks/${taskId}/test-cases/grouped`)
  }

  createTestCase = async (taskId: string, data: {
    title: string
    description?: string
    test_steps: string
    expected_result: string
  }): Promise<TestCase> => {
    return this.authenticatedRequest(`/tasks/${taskId}/test-cases`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  getTestCase = async (testCaseId: string): Promise<TestCase> => {
    return this.authenticatedRequest(`/test-cases/${testCaseId}`)
  }

  updateTestCase = async (testCaseId: string, data: {
    title?: string
    description?: string
    test_steps?: string
    expected_result?: string
    status?: 'pending' | 'running' | 'passed' | 'failed'
  }): Promise<TestCase> => {
    return this.authenticatedRequest(`/test-cases/${testCaseId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  deleteTestCase = async (testCaseId: string): Promise<{ message: string }> => {
    return this.authenticatedRequest(`/test-cases/${testCaseId}`, {
      method: 'DELETE',
    })
  }

  executeTestCase = async (testCaseId: string): Promise<{
    message: string
    test_case_id: string
    status: string
  }> => {
    return this.authenticatedRequest(`/test-cases/${testCaseId}/execute`, {
      method: 'POST',
    })
  }

  getTestCaseHooks = async (testCaseId: string): Promise<{ hooks: any[] }> => {
    return this.authenticatedRequest(`/test-cases/${testCaseId}/hooks`)
  }

  // AI Test Case Generation (requires authentication)
  generateTestCasesFromSession = async (sessionId: string, data: {
    session_id: string
    max_test_cases?: number
    focus_areas?: string[]
  }): Promise<{
    generated_count: number
    test_cases: Array<TestCase & {
      source: 'manual' | 'ai_generated'
      session_id?: string
      ai_model_used?: string
      category?: string
    }>
    generation_summary: string
  }> => {
    return this.authenticatedRequest(`/sessions/${sessionId}/generate-test-cases`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  generateAndExecuteTestCases = async (sessionId: string, data: {
    session_id: string
    max_test_cases?: number
    focus_areas?: string[]
  }): Promise<{
    message: string
    generated_count: number
    executing_test_case_ids: string[]
    generation_summary: string
  }> => {
    return this.authenticatedRequest(`/sessions/${sessionId}/test-cases/generate-and-execute`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  // Deployment Guide (requires authentication)
  getDeploymentGuide = async (taskId: string): Promise<{
    content: string
    task_id: string
    updated_at: string | null
  }> => {
    return this.authenticatedRequest(`/tasks/${taskId}/deployment-guide`)
  }

  updateDeploymentGuide = async (taskId: string, content: string): Promise<{
    message: string
    task_id: string
    content: string
    updated_at: string
  }> => {
    return this.authenticatedRequest(`/tasks/${taskId}/deployment-guide`, {
      method: 'PUT',
      body: JSON.stringify({ content }),
    })
  }
}

export const api = new ApiClient() as ApiClient & ExtendedApiClient

/**
 * Helper function to get authentication headers for extended API methods
 */
function getAuthHeaders(): HeadersInit {
  const storedUser = typeof window !== 'undefined' ? localStorage.getItem('github_user') : null
  if (!storedUser) {
    throw new Error('User not authenticated. Please log in with GitHub.')
  }

  try {
    const user = JSON.parse(storedUser)
    if (!user.id) {
      throw new Error('Invalid user data. Please re-authenticate.')
    }

    return {
      'Content-Type': 'application/json',
      'X-User-ID': user.id,
    }
  } catch (e) {
    throw new Error('Failed to parse user data. Please re-authenticate.')
  }
}

// Extend api object with additional methods
Object.assign(api, {
  // Get all messages for a session
  getSessionChats: async (sessionId: string) => {
    const response = await fetch(`${API_BASE_URL}/api/chats/session/${sessionId}`)
    if (!response.ok) throw new Error('Failed to get session chats')
    return response.json()
  },

  // Get all sessions for a sub-project
  getSubProjectSessions: async (subProjectId: string) => {
    const response = await fetch(`${API_BASE_URL}/api/sub-projects/${subProjectId}/sessions`)
    if (!response.ok) throw new Error('Failed to get sub-project sessions')
    return response.json()
  },
  
  // Get hooks for a specific message
  getMessageHooks: async (messageId: string): Promise<{ hooks: ChatHook[] }> => {
    const response = await fetch(`${API_BASE_URL}/api/messages/${messageId}/hooks`)
    if (!response.ok) throw new Error('Failed to fetch message hooks')
    return response.json()
  },
  
  // Get pending MCP approval requests
  getMCPApprovals: async (params?: { cwd?: string; sub_project_id?: string }) => {
    const queryParams = new URLSearchParams()
    if (params?.cwd) queryParams.append('cwd', params.cwd)
    if (params?.sub_project_id) queryParams.append('sub_project_id', params.sub_project_id)
    
    const queryString = queryParams.toString()
    const response = await fetch(`${API_BASE_URL}/api/approvals/pending${queryString ? `?${queryString}` : ''}`)
    if (!response.ok) throw new Error('Failed to get MCP approvals')
    return response.json()
  },
  
  // Continue chat with auto-generated message
  continueChat: async (chatId: string): Promise<{
    needs_continuation: boolean
    auto_message_id?: string
    continuation_prompt?: string
    reasoning?: string
  }> => {
    const response = await fetch(`${API_BASE_URL}/api/chats/${chatId}/continue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    })
    if (!response.ok) throw new Error('Failed to continue chat')
    return response.json()
  },
  
  // Toggle auto-continuation for a session
  toggleAutoContinuation: async (sessionId: string, enabled: boolean): Promise<{
    session_id: string
    auto_continuation_enabled: boolean
    updated_count: number
  }> => {
    const response = await fetch(`${API_BASE_URL}/api/chats/toggle-auto-continuation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, enabled })
    })
    if (!response.ok) throw new Error('Failed to toggle auto-continuation')
    return response.json()
  },
  
  // Toggle bypass mode for a session
  toggleBypassMode: async (sessionId: string, enabled: boolean): Promise<{
    session_id: string
    bypass_mode_enabled: boolean
    updated_count: number
  }> => {
    const response = await fetch(`${API_BASE_URL}/api/chats/toggle-bypass-mode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, enabled })
    })
    if (!response.ok) throw new Error('Failed to toggle bypass mode')
    return response.json()
  },

  // Contest Harvesting API methods
  startContestHarvesting: async (taskId: string, data?: { context_prompt?: string }): Promise<{
    session_id: string
    total_questions: number
    message: string
  }> => {
    const response = await fetch(`${API_BASE_URL}/api/tasks/${taskId}/contest-harvesting/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data || {})
    })
    if (!response.ok) throw new Error('Failed to start contest harvesting')
    return response.json()
  },

  getContestHarvestingSessions: async (taskId: string): Promise<{
    sessions: Array<{
      id: string
      task_id: string
      total_questions: number
      questions_answered: number
      status: string
      created_at: string
    }>
    total_sessions: number
  }> => {
    const response = await fetch(`${API_BASE_URL}/api/tasks/${taskId}/contest-harvesting/sessions`)
    if (!response.ok) throw new Error('Failed to get contest harvesting sessions')
    return response.json()
  },

  getContestHarvestingSession: async (sessionId: string): Promise<{
    session: {
      id: string
      task_id: string
      total_questions: number
      questions_answered: number
      status: string
      created_at: string
    }
    questions: Array<{
      id: string
      question_text: string
      answer?: string
      category: string
      priority: number
      order: number
      status: string
      answered_at?: string
    }>
  }> => {
    const response = await fetch(`${API_BASE_URL}/api/contest-harvesting/sessions/${sessionId}`)
    if (!response.ok) throw new Error('Failed to get contest harvesting session')
    return response.json()
  },

  getCurrentQuestion: async (sessionId: string): Promise<{
    question?: {
      id: string
      question_text: string
      category: string
      priority: number
      order: number
      status: string
    }
    message?: string
  }> => {
    const response = await fetch(`${API_BASE_URL}/api/contest-harvesting/sessions/${sessionId}/current-question`)
    if (!response.ok) throw new Error('Failed to get current question')
    return response.json()
  },

  answerContestHarvestingQuestion: async (questionId: string, data: { answer: string }): Promise<{
    success: boolean
    message: string
    next_question?: {
      id: string
      question_text: string
      category: string
      priority: number
      order: number
      status: string
    }
  }> => {
    const response = await fetch(`${API_BASE_URL}/api/contest-harvesting/questions/${questionId}/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (!response.ok) throw new Error('Failed to answer question')
    return response.json()
  },

  skipContestHarvestingQuestion: async (questionId: string, reason?: string): Promise<{
    success: boolean
    message: string
    next_question?: {
      id: string
      question_text: string
      category: string
      priority: number
      order: number
      status: string
    }
  }> => {
    const response = await fetch(`${API_BASE_URL}/api/contest-harvesting/questions/${questionId}/skip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason })
    })
    if (!response.ok) throw new Error('Failed to skip question')
    return response.json()
  },

  // Four-Stage Issue Resolution Workflow Endpoints
  getIssueResolutionStageStatus: async (projectId: string, issueNumber: number): Promise<{
    current_stage: 'deployment' | 'planning' | 'implementation' | 'testing'
    resolution_state: string
    stages: {
      deployment: {
        complete: boolean
        started_at?: string
        completed_at?: string
      }
      planning: {
        complete: boolean
        approved: boolean
        session_id?: string
        chat_id?: string
        started_at?: string
        completed_at?: string
        approved_by?: string
        approved_at?: string
      }
      implementation: {
        complete: boolean
        session_id?: string
        chat_id?: string
        started_at?: string
        completed_at?: string
      }
      testing: {
        complete: boolean
        tests_generated: number
        tests_passed: number
        started_at?: string
        completed_at?: string
      }
    }
    can_transition: boolean
    next_action: string
    retry_count: number
    error_message?: string
  }> => {
    const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/issues/${issueNumber}/resolution/stage-status`, {
      method: 'GET',
      headers: getAuthHeaders(),
    })
    if (!response.ok) throw new Error('Failed to get stage status')
    return response.json()
  },

  approvePlanAndStartImplementation: async (
    projectId: string,
    issueNumber: number,
    sessionId: string,
    notes?: string
  ): Promise<{
    stage: string
    session_id: string
    chat_id: string
    task_id: string
    message: string
  }> => {
    const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/issues/${issueNumber}/resolution/approve-plan`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ session_id: sessionId, notes })
    })
    if (!response.ok) throw new Error('Failed to approve plan')
    return response.json()
  },

  retryIssueResolutionStage: async (projectId: string, issueNumber: number): Promise<{
    success: boolean
    message: string
    result: any
  }> => {
    const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/issues/${issueNumber}/resolution/retry-stage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
    if (!response.ok) throw new Error('Failed to retry stage')
    return response.json()
  },

  triggerPlanningStage: async (projectId: string, issueNumber: number): Promise<{
    message: string
    resolution_id: string
    current_stage: string
  }> => {
    const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/issues/${issueNumber}/resolution/trigger-planning`, {
      method: 'POST',
      headers: getAuthHeaders(),
    })
    if (!response.ok) throw new Error('Failed to trigger planning stage')
    return response.json()
  },

  // GitHub Issue and Resolution Management
  getGithubIssue: async (projectId: string, issueNumber: number) => {
    const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/issues/${issueNumber}`)
    if (!response.ok) {
      if (response.status === 404) return null
      throw new Error('Failed to fetch issue')
    }
    return response.json()
  },

  getIssueResolution: async (projectId: string, issueNumber: number) => {
    const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/issues/${issueNumber}/resolution`)
    if (!response.ok) {
      if (response.status === 404) return null
      throw new Error('Failed to fetch resolution')
    }
    return response.json()
  },

  triggerIssueResolution: async (projectId: string, data: {
    issue_number: number
    issue_title: string
    issue_body: string
    github_url: string
  }) => {
    const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/issues/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!response.ok) throw new Error('Failed to trigger resolution')
    return response.json()
  },

  // Test Case Management for Issue Resolution
  getTaskTestCases: async (taskId: string) => {
    const response = await fetch(`${API_BASE_URL}/api/tasks/${taskId}/test-cases`)
    if (!response.ok) throw new Error('Failed to fetch test cases')
    return response.json()
  },

  generateTestCases: async (taskId: string, options: {
    test_types: string[]
    auto_execute: boolean
  }) => {
    const response = await fetch(`${API_BASE_URL}/api/tasks/${taskId}/generate-test-cases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options),
    })
    if (!response.ok) throw new Error('Failed to generate test cases')
    return response.json()
  },

  // Session and Chat APIs for Workflow
  getSessionChat: async (sessionId: string) => {
    const response = await fetch(`${API_BASE_URL}/api/sessions/${sessionId}/chats`)
    if (!response.ok) throw new Error('Failed to fetch session chats')
    return response.json()
  },

  getChatHooks: async (chatId: string) => {
    const response = await fetch(`${API_BASE_URL}/api/chats/${chatId}/hooks`)
    if (!response.ok) throw new Error('Failed to fetch chat hooks')
    return response.json()
  },

  getTestCaseHooks: async (taskId: string) => {
    const response = await fetch(`${API_BASE_URL}/api/tasks/${taskId}/test-case-hooks`)
    if (!response.ok) throw new Error('Failed to fetch test case hooks')
    return response.json()
  },
})

export default api