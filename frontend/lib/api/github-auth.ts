import { GitHubUser } from '../types/github';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:9000';

export async function getGitHubAuthUrl(): Promise<{ authorization_url: string; state: string }> {
  const response = await fetch(`${API_BASE}/api/github/auth/authorize`);
  if (!response.ok) throw new Error('Failed to get auth URL');
  return response.json();
}

export async function exchangeOAuthCode(code: string, state: string): Promise<GitHubUser> {
  const response = await fetch(`${API_BASE}/api/github/auth/callback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, state }),
  });
  if (!response.ok) throw new Error('OAuth exchange failed');
  return response.json();
}

export async function getCurrentUser(userId: string): Promise<GitHubUser> {
  const response = await fetch(`${API_BASE}/api/github/auth/me?user_id=${userId}`);
  if (!response.ok) throw new Error('Failed to get user');
  return response.json();
}

export async function logoutGitHub(userId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/api/github/auth/logout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId }),
  });
  if (!response.ok) throw new Error('Logout failed');
}
