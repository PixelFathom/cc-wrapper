import { parseGitUrl, getGitHubUrl } from './git-url-parser'

describe('parseGitUrl', () => {
  it('should parse SSH format', () => {
    const result = parseGitUrl('git@github.com:username/cc-wrapper.git')
    expect(result).toEqual({
      owner: 'username',
      repo: 'cc-wrapper'
    })
  })

  it('should parse SSH format without .git', () => {
    const result = parseGitUrl('git@github.com:owner/repo')
    expect(result).toEqual({
      owner: 'owner',
      repo: 'repo'
    })
  })

  it('should parse SSH URL format', () => {
    const result = parseGitUrl('ssh://git@github.com/owner/repo.git')
    expect(result).toEqual({
      owner: 'owner',
      repo: 'repo'
    })
  })

  it('should parse HTTPS format', () => {
    const result = parseGitUrl('https://github.com/owner/repo.git')
    expect(result).toEqual({
      owner: 'owner',
      repo: 'repo'
    })
  })

  it('should parse HTTPS format without .git', () => {
    const result = parseGitUrl('https://github.com/owner/repo')
    expect(result).toEqual({
      owner: 'owner',
      repo: 'repo'
    })
  })

  it('should return null for invalid URLs', () => {
    expect(parseGitUrl('')).toBeNull()
    expect(parseGitUrl('not-a-url')).toBeNull()
    expect(parseGitUrl('https://github.com')).toBeNull()
  })
})

describe('getGitHubUrl', () => {
  it('should convert SSH to HTTPS', () => {
    expect(getGitHubUrl('git@github.com:owner/repo.git')).toBe('https://github.com/owner/repo')
  })

  it('should keep HTTPS as is', () => {
    expect(getGitHubUrl('https://github.com/owner/repo.git')).toBe('https://github.com/owner/repo')
  })

  it('should return original for unparseable URLs', () => {
    expect(getGitHubUrl('invalid-url')).toBe('invalid-url')
  })
})