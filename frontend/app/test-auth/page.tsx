import { auth } from '@clerk/nextjs/server';

export default async function TestAuthPage() {
  const { userId } = await auth();

  return (
    <div className="container mx-auto px-6 py-20">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-cyan-500">Authentication Test Page</h1>
        
        <div className="bg-card rounded-lg border border-border p-6">
          <h2 className="text-xl font-semibold mb-4">Authentication Status</h2>
          
          {userId ? (
            <div>
              <p className="text-green-500 mb-2">✓ Authenticated</p>
              <p className="text-muted-foreground">User ID: {userId}</p>
            </div>
          ) : (
            <div>
              <p className="text-yellow-500 mb-2">⚠ Not authenticated</p>
              <p className="text-muted-foreground">Please sign in to view your user ID</p>
            </div>
          )}
        </div>
        
        <div className="mt-8 bg-card rounded-lg border border-border p-6">
          <h2 className="text-xl font-semibold mb-4">Instructions</h2>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground">
            <li>Click "Sign In" or "Sign Up" in the navigation bar</li>
            <li>Create an account or sign in with existing credentials</li>
            <li>After authentication, refresh this page to see your user ID</li>
            <li>Click on your profile icon to manage your account</li>
          </ul>
        </div>
      </div>
    </div>
  );
}