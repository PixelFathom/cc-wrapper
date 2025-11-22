'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { GitHubLogoIcon } from '@radix-ui/react-icons';
import { User, LogOut, ChevronDown } from 'lucide-react';
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
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="relative group p-0 h-auto hover:bg-transparent"
          >
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
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </div>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel>
            <div className="flex flex-col">
              <span className="text-sm font-semibold">{user.github_login}</span>
              {user.email && (
                <span className="text-xs text-gray-500 font-normal truncate">
                  {user.email}
                </span>
              )}
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/profile" className="flex items-center cursor-pointer">
              <User className="h-4 w-4 mr-2" />
              Edit Profile
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={handleLogout}
            className="text-red-500 focus:text-red-500 cursor-pointer"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
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
