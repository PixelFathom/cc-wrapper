'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { exchangeOAuthCode } from '@/lib/api/github-auth';
import { Loader2 } from 'lucide-react';

function GitHubCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const savedState = sessionStorage.getItem('github_oauth_state');

      if (!code || !state) {
        setError('Missing OAuth parameters');
        return;
      }

      if (state !== savedState) {
        setError('Invalid state parameter - possible CSRF attack');
        return;
      }

      try {
        const user = await exchangeOAuthCode(code, state);

        // Store user session
        sessionStorage.setItem('github_user_id', user.id);
        localStorage.setItem('github_user', JSON.stringify(user));

        // Clean up
        sessionStorage.removeItem('github_oauth_state');

        // Redirect to home page
        router.push('/');
      } catch (err) {
        setError('Failed to authenticate with GitHub. Please try again.');
        console.error('GitHub OAuth error:', err);
      }
    };

    handleCallback();
  }, [searchParams, router]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-4">
        <div className="terminal-bg rounded-lg border border-red-500/50 p-6 max-w-md text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <a href="/" className="text-cyan-500 hover:text-cyan-400 underline">
            Return to home
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <div className="terminal-bg rounded-lg border border-border p-8">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
          <div className="font-mono">
            <p className="text-cyan-500">Completing GitHub authentication...</p>
            <p className="text-xs text-muted-foreground mt-2">Please wait</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function GitHubCallbackPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <div className="terminal-bg rounded-lg border border-border p-8">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
            <div className="font-mono">
              <p className="text-cyan-500">Loading...</p>
            </div>
          </div>
        </div>
      </div>
    }>
      <GitHubCallbackContent />
    </Suspense>
  );
}
