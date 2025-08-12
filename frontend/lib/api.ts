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
}

class ApiClient {
  private baseUrl: string

  constructor() {
    this.baseUrl = `${API_BASE_URL}/api`
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

  // Projects
  getProjects = async (): Promise<Project[]> => {
    return this.request('/projects')
  }

  createProject = async (data: { name: string; repo_url: string }): Promise<Project> => {
    return this.request('/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  getProject = async (id: string): Promise<Project> => {
    return this.request(`/projects/${id}`)
  }

  // Tasks
  getTasks = async (projectId: string): Promise<Task[]> => {
    return this.request(`/projects/${projectId}/tasks`)
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
    return this.request('/tasks', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  getTask = async (id: string): Promise<Task> => {
    return this.request(`/tasks/${id}`)
  }

  getTaskSubProjects = async (taskId: string): Promise<{ task_id: string; sub_projects: Array<{ id: string; created_at: string }> }> => {
    return this.request(`/tasks/${taskId}/sub-projects`)
  }

  // Chat
  sendQuery = async (data: {
    prompt: string
    session_id?: string
    org_name: string
    cwd: string
    webhook_url?: string
    bypass_mode?: boolean
    agent_name?: string | null
  }): Promise<{ session_id: string; assistant_response: string; chat_id?: string }> => {
    return this.request('/query', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  // Chat with hooks
  sendChatQuery = async (chatId: string, data: {
    prompt: string
    session_id?: string
  }): Promise<{ session_id: string; assistant_response: string }> => {
    return this.request(`/chats/${chatId}/query`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  getChatHooks = async (chatId: string, sessionId?: string, limit: number = 50): Promise<ChatHooksResponse> => {
    const params = new URLSearchParams()
    if (sessionId) params.append('session_id', sessionId)
    params.append('limit', limit.toString())
    
    const queryString = params.toString()
    return this.request(`/chats/${chatId}/hooks${queryString ? `?${queryString}` : ''}`)
  }

  getMessageHooks = async (messageId: string, limit: number = 50): Promise<ChatHooksResponse> => {
    const params = new URLSearchParams()
    params.append('limit', limit.toString())
    
    const queryString = params.toString()
    return this.request(`/messages/${messageId}/hooks${queryString ? `?${queryString}` : ''}`)
  }

  // Approvals
  getPendingApprovals = async (params?: { cwd?: string; sub_project_id?: string }): Promise<Approval[]> => {
    const queryParams = new URLSearchParams()
    if (params?.cwd) queryParams.append('cwd', params.cwd)
    if (params?.sub_project_id) queryParams.append('sub_project_id', params.sub_project_id)
    
    const queryString = queryParams.toString()
    return this.request(`/approvals/pending${queryString ? `?${queryString}` : ''}`)
  }

  submitApprovalResult = async (data: {
    approval_id: string
    decision: string
    comment?: string
  }): Promise<{ message: string }> => {
    return this.request('/approvals/result', {
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

  // Deployment
  getTaskDeploymentHooks = async (taskId: string, limit: number = 20): Promise<DeploymentHooksResponse> => {
    return this.request(`/tasks/${taskId}/deployment-hooks?limit=${limit}`)
  }

  retryTaskDeployment = async (taskId: string): Promise<{ status: string; request_id?: string }> => {
    return this.request(`/tasks/${taskId}/retry-deployment`, {
      method: 'POST',
    })
  }

  // VS Code
  getTaskVSCodeLink = async (taskId: string, filePath?: string): Promise<{ tunnel_link: string; tunnel_name: string }> => {
    const queryParams = filePath ? `?file_path=${encodeURIComponent(filePath)}` : ''
    return this.request(`/tasks/${taskId}/vscode-link${queryParams}`)
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

    const response = await fetch(`${this.baseUrl}/tasks/${taskId}/knowledge-base/upload`, {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      throw new Error(`Knowledge Base upload error: ${response.statusText}`)
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
    return this.request(`/tasks/${taskId}/knowledge-base/files`)
  }
}

export const api = new ApiClient() as ApiClient & ExtendedApiClient

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
})