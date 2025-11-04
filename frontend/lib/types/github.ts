export interface GitHubUser {
  id: string;
  github_id: number;
  github_login: string;
  github_name?: string;
  email?: string;
  avatar_url?: string;
  bio?: string;
  company?: string;
  location?: string;
  blog?: string;
  public_repos: number;
  followers: number;
  following: number;
}

export interface GitHubRepository {
  id: string;
  github_repo_id: number;
  owner: string;
  name: string;
  full_name: string;
  description?: string;
  is_private: boolean;
  is_fork: boolean;
  is_archived: boolean;
  html_url: string;
  clone_url: string;
  stars_count: number;
  forks_count: number;
  open_issues_count: number;
  language?: string;
  topics?: string[];
  default_branch: string;
  github_updated_at: string;
  last_synced_at: string;
  is_initialized: boolean;
}

export interface GitHubIssue {
  id: string;
  repository_id: string;
  github_issue_number: number;
  title: string;
  body?: string;
  state: string;
  labels?: string[];
  author_login: string;
  author_avatar_url?: string;
  assignees?: string[];
  comments_count: number;
  reactions_count: number;
  html_url: string;
  github_created_at: string;
  github_updated_at: string;
  is_task_generated: boolean;
  generated_task_id?: string;
  priority?: string;
}

export interface RepositoryListResponse {
  repositories: GitHubRepository[];
  total: number;
  page: number;
  per_page: number;
}

export interface IssueListResponse {
  issues: GitHubIssue[];
  total: number;
  page: number;
  per_page: number;
}
