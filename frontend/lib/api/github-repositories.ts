/**
 * GitHub Repositories API client
 * Uses authenticated endpoints with X-User-ID header
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

export interface GitHubRepository {
  id: number; // GitHub repo ID
  name: string;
  full_name: string;
  owner: string;
  description: string | null;
  is_private: boolean;
  is_fork: boolean;
  is_archived: boolean;
  html_url: string;
  clone_url: string;
  ssh_url: string;
  stars_count: number;
  forks_count: number;
  open_issues_count: number;
  language: string | null;
  topics: string[];
  default_branch: string;
  updated_at: string;
  is_initialized: boolean;
}

export interface RepositoryListResponse {
  repositories: GitHubRepository[];
  total: number;
  page: number;
  per_page: number;
}

export interface InitializeRepositoryRequest {
  github_repo_id: number;
  project_name?: string;
  task_name: string; // Required: task name for initialization
}

export interface InitializeRepositoryResponse {
  project_id: string;
  task_id: string;
  message: string;
}

/**
 * Fetch user's GitHub repositories
 * Fetches directly from GitHub API - no database caching
 */
export async function fetchGitHubRepositories(
  options: {
    page?: number;
    per_page?: number;
  } = {}
): Promise<RepositoryListResponse> {
  const { page = 1, per_page = 100 } = options;

  const params = new URLSearchParams({
    page: page.toString(),
    per_page: per_page.toString(),
  });

  const response = await fetch(
    `${API_URL}/api/github/repositories?${params}`,
    {
      method: 'GET',
      headers: getAuthHeaders(),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to fetch repositories');
  }

  return response.json();
}

/**
 * Initialize a GitHub repository as a project
 */
export async function initializeRepository(
  data: InitializeRepositoryRequest
): Promise<InitializeRepositoryResponse> {
  const response = await fetch(
    `${API_URL}/api/github/repositories/initialize`,
    {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to initialize repository');
  }

  return response.json();
}
