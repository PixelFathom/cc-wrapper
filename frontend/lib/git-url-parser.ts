/**
 * Parse Git URLs (both HTTPS and SSH formats)
 * Handles:
 * - https://github.com/owner/repo.git
 * - git@github.com:owner/repo.git
 * - ssh://git@github.com/owner/repo.git
 */
export function parseGitUrl(url: string): { owner: string; repo: string } | null {
  if (!url) return null

  // Remove .git suffix if present
  const cleanUrl = url.replace(/\.git$/, '')

  // SSH format: git@github.com:owner/repo
  const sshMatch = cleanUrl.match(/^git@[^:]+:([^/]+)\/(.+)$/)
  if (sshMatch) {
    return {
      owner: sshMatch[1],
      repo: sshMatch[2]
    }
  }

  // SSH URL format: ssh://git@github.com/owner/repo
  const sshUrlMatch = cleanUrl.match(/^ssh:\/\/git@[^/]+\/([^/]+)\/(.+)$/)
  if (sshUrlMatch) {
    return {
      owner: sshUrlMatch[1],
      repo: sshUrlMatch[2]
    }
  }

  // HTTPS format: https://github.com/owner/repo
  try {
    const parsedUrl = new URL(cleanUrl)
    const pathParts = parsedUrl.pathname.split('/').filter(Boolean)
    if (pathParts.length >= 2) {
      return {
        owner: pathParts[0],
        repo: pathParts[1]
      }
    }
  } catch {
    // Not a valid URL, continue to other formats
  }

  return null
}

/**
 * Get GitHub URL from various Git URL formats
 * Always returns the HTTPS URL for consistency
 */
export function getGitHubUrl(gitUrl: string): string {
  const parsed = parseGitUrl(gitUrl)
  if (parsed) {
    return `https://github.com/${parsed.owner}/${parsed.repo}`
  }
  // Fallback to original URL if parsing fails
  return gitUrl
}