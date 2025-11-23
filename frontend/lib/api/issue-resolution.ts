/**
 * Issue Resolution API client
 * Manages GitHub issue resolution workflow
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:9000';

/**
 * Get authentication headers from stored user
 */
function getAuthHeaders(): HeadersInit {
  const storedUser = localStorage.getItem('github_user');
  if (!storedUser) {
    throw new Error('User not authenticated. Please log in with GitHub.');
  }

  try {
    const user = JSON.parse(storedUser);
    if (!user.id) {
      throw new Error('Invalid user data. Please re-authenticate.');
    }

    return {
      'Content-Type': 'application/json',
      'X-User-ID': user.id,
    };
  } catch (e) {
    throw new Error('Failed to parse user data. Please re-authenticate.');
  }
}

export interface GitHubIssue {
  number: number;
  title: string;
  body: string | null;
  state: string; // 'open' | 'closed'
  labels: string[];
  html_url: string;
  user: string;
  created_at: string;
  updated_at: string;
  comments_count: number;
  has_resolution_task: boolean;
  resolution_task_id: string | null;
}

export interface IssueListResponse {
  issues: GitHubIssue[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number | null;
  has_next: boolean;
  has_prev: boolean;
}

export interface SolveIssueRequest {
  issue_title: string;
  issue_body: string;
  task_name?: string;
}

export interface SolveIssueResponse {
  task_id: string;
  resolution_id: string;
  project_id: string;
  message: string;
}

export interface IssueResolutionStatus {
  resolution_id: string;
  task_id: string;
  chat_id: string | null;
  session_id: string | null;
  issue_number: number;
  issue_title: string;
  issue_body: string | null;
  issue_labels: string[] | null;
  resolution_state: string;
  resolution_branch: string | null;
  auto_query_triggered: boolean;
  auto_query_session_id: string | null;
  auto_query_completed: boolean;
  solution_approach: string | null;
  files_changed: string[] | null;
  test_cases_generated: number;
  test_cases_passed: number;
  pr_number: number | null;
  pr_url: string | null;
  pr_state: string | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
}

export interface CreatePRRequest {
  title?: string;
  body?: string;
  branch?: string;
}

export interface CreatePRResponse {
  pr_number: number;
  pr_url: string;
  message: string;
}

/**
 * Fetch GitHub issues for a project
 */
export async function fetchProjectIssues(
  projectId: string,
  options: {
    state?: 'open' | 'closed' | 'all';
    page?: number;
    per_page?: number;
  } = {}
): Promise<IssueListResponse> {
  const { state = 'open', page = 1, per_page = 30 } = options;

  const params = new URLSearchParams({
    state,
    page: page.toString(),
    per_page: per_page.toString(),
  });

  const response = await fetch(
    `${API_URL}/api/projects/${projectId}/issues?${params}`,
    {
      method: 'GET',
      headers: getAuthHeaders(),
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to fetch issues' }));
    throw new Error(error.detail || 'Failed to fetch issues');
  }

  return response.json();
}

/**
 * Create a resolution task for a GitHub issue (requires existing project)
 */
export async function solveGitHubIssue(
  projectId: string,
  issueNumber: number,
  data: SolveIssueRequest
): Promise<SolveIssueResponse> {
  const response = await fetch(
    `${API_URL}/api/projects/${projectId}/issues/${issueNumber}/solve`,
    {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to create resolution task' }));
    throw new Error(error.detail || 'Failed to create resolution task');
  }

  return response.json();
}

/**
 * Get the status of an issue resolution
 */
export async function getIssueResolutionStatus(
  projectId: string,
  taskId: string
): Promise<IssueResolutionStatus> {
  const response = await fetch(
    `${API_URL}/api/projects/${projectId}/tasks/${taskId}/resolution`,
    {
      method: 'GET',
      headers: getAuthHeaders(),
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to fetch resolution status' }));
    throw new Error(error.detail || 'Failed to fetch resolution status');
  }

  return response.json();
}

/**
 * Send a chat message for issue resolution
 */
export async function sendIssueResolutionMessage(
  projectId: string,
  taskId: string,
  message: string
): Promise<{
  success: boolean;
  session_id: string;
  chat_id: string;
  assistant_chat_id: string;
  message: string;
}> {
  const response = await fetch(
    `${API_URL}/api/projects/${projectId}/tasks/${taskId}/resolution/chat`,
    {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ message }),
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to send message' }));
    throw new Error(error.detail || 'Failed to send message');
  }

  return response.json();
}

/**
 * Create a pull request for a resolved issue
 */
export async function createPullRequest(
  projectId: string,
  taskId: string,
  data: CreatePRRequest = {}
): Promise<CreatePRResponse> {
  const response = await fetch(
    `${API_URL}/api/projects/${projectId}/tasks/${taskId}/resolution/create-pr`,
    {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to create pull request' }));
    throw new Error(error.detail || 'Failed to create pull request');
  }

  return response.json();
}
