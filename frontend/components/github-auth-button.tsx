'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { GitHubLogoIcon, ExitIcon } from '@radix-ui/react-icons';
import { getGitHubAuthUrl } from '@/lib/api/github-auth';

export function GitHubAuthButton() {
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    // Check if user is already authenticated
    const storedUser = localStorage.getItem('github_user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        console.error('Failed to parse stored user:', e);
      }
    }
  }, []);

  const handleLogin = async () => {
    setLoading(true);
    try {
      const { authorization_url, state } = await getGitHubAuthUrl();
      // Store state in session for verification
      sessionStorage.setItem('github_oauth_state', state);
      // Redirect to GitHub
      window.location.href = authorization_url;
    } catch (error) {
      console.error('Failed to initiate GitHub login:', error);
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('github_user');
    sessionStorage.removeItem('github_user_id');
    setUser(null);
    window.location.reload();
  };

  if (user) {
    return (
      <div className="flex items-center gap-2">
        <div className="relative group">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg blur opacity-20 group-hover:opacity-40 transition duration-300"></div>
          <div className="relative flex items-center gap-2 bg-card/80 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-purple-500/30">
            {user.avatar_url && (
              <img
                src={user.avatar_url}
                alt={user.github_login}
                className="w-5 h-5 rounded-full ring-1 ring-purple-500/50"
              />
            )}
            <div className="flex items-center gap-1">
              <span className="text-xs font-mono text-purple-400">@</span>
              <span className="text-xs font-mono text-cyan-400">{user.github_login}</span>
            </div>
          </div>
        </div>
        <Button
          onClick={handleLogout}
          variant="ghost"
          size="sm"
          className="text-xs text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
        >
          <ExitIcon className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <Button
      onClick={handleLogin}
      disabled={loading}
      size="sm"
      variant="outline"
      className="relative group bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-purple-500/30 hover:border-purple-400/50 text-purple-400 hover:text-purple-300 hover:bg-purple-500/20 transition-all duration-200 font-mono text-xs"
    >
      <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg blur opacity-0 group-hover:opacity-20 transition duration-300"></div>
      <div className="relative flex items-center">
        <GitHubLogoIcon className="mr-2 h-4 w-4" />
        {loading ? (
          <span className="flex items-center gap-1">
            <span className="animate-pulse">$</span>
            <span>connecting...</span>
          </span>
        ) : (
          <span>$ github auth</span>
        )}
      </div>
    </Button>
  );
}
