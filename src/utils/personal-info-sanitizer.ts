/**
 * Utility functions to detect and sanitize personal information from URLs, domains, and slugs
 * Prevents exposure of usernames, email addresses, file paths, and other personal data
 */

/**
 * Patterns that indicate personal information
 */
const PERSONAL_INFO_PATTERNS = [
  // Email addresses
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  // Common username patterns (e.g., ryanmartin, user123)
  /\b(users?|user-|username|user_)[a-zA-Z0-9_-]*/gi,
  // File path patterns (e.g., /Users/ryanmartin, /home/user)
  /\/Users\/[a-zA-Z0-9_-]+/gi,
  /\/home\/[a-zA-Z0-9_-]+/gi,
  // Common personal name patterns (detect common first/last name combinations)
  // This is a basic check - we'll be more aggressive in sanitization
  /\b(ryan|martin|john|jane|smith|doe)[a-zA-Z0-9_-]*/gi,
]

/**
 * Common personal information keywords that should never appear in domains/URLs
 */
const PERSONAL_KEYWORDS = [
  'gmail',
  'yahoo',
  'hotmail',
  'outlook',
  'email',
  'user',
  'users',
  'username',
  'personal',
  'private',
]

/**
 * Checks if a string contains personal information patterns
 * Focuses on URLs, domains, and identifiers that shouldn't appear in public-facing content
 */
export function containsPersonalInfo(text: string): boolean {
  const lowerText = text.toLowerCase()
  
  // Check for email addresses (always a red flag)
  if (/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(text)) {
    console.log(`[PersonalInfoSanitizer] Detected email address in: ${text}`)
    return true
  }
  
  // Check for file path patterns (e.g., /Users/ryanmartin, /home/user)
  if (/\/Users\/[a-zA-Z0-9_-]+/.test(text) || /\/home\/[a-zA-Z0-9_-]+/.test(text)) {
    console.log(`[PersonalInfoSanitizer] Detected file path in: ${text}`)
    return true
  }
  
  // Check for personal keywords in URL/domain context (not just anywhere in text)
  // Look for patterns like: http://gmail.com, https://user-domain.com, etc.
  const urlPattern = /https?:\/\/[^\s]+/gi
  const urls = text.match(urlPattern) || []
  
  for (const url of urls) {
    const lowerUrl = url.toLowerCase()
    for (const keyword of PERSONAL_KEYWORDS) {
      if (lowerUrl.includes(keyword)) {
        console.log(`[PersonalInfoSanitizer] Detected personal keyword "${keyword}" in URL: ${url}`)
        return true
      }
    }
  }
  
  // Also check for common username patterns in URLs/domains
  // Pattern: username.domain.com or domain.com/username
  if (/[a-zA-Z0-9_-]+\.(gmail|yahoo|hotmail|outlook|email)\.(com|net|org)/i.test(text)) {
    console.log(`[PersonalInfoSanitizer] Detected email domain pattern in: ${text}`)
    return true
  }
  
  // Check for file path patterns in URLs
  if (/https?:\/\/[^\/]+\/(Users|home)\/[a-zA-Z0-9_-]+/i.test(text)) {
    console.log(`[PersonalInfoSanitizer] Detected file path in URL: ${text}`)
    return true
  }
  
  return false
}

/**
 * Sanitizes a URL or domain by removing or replacing personal information
 */
export function sanitizeUrl(url: string): string {
  let sanitized = url
  
  // Remove email addresses
  sanitized = sanitized.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[email-removed]')
  
  // Remove file path patterns
  sanitized = sanitized.replace(/\/Users\/[a-zA-Z0-9_-]+/g, '/[user-path-removed]')
  sanitized = sanitized.replace(/\/home\/[a-zA-Z0-9_-]+/g, '/[user-path-removed]')
  
  // Remove personal keywords from domain/URL
  for (const keyword of PERSONAL_KEYWORDS) {
    const regex = new RegExp(`\\b${keyword}\\b`, 'gi')
    sanitized = sanitized.replace(regex, '[removed]')
  }
  
  return sanitized
}

/**
 * Validates that a URL/domain does not contain personal information
 * Throws an error if personal information is detected
 */
export function validateUrlForPersonalInfo(url: string): void {
  if (containsPersonalInfo(url)) {
    const sanitized = sanitizeUrl(url)
    throw new Error(
      `URL contains personal information and has been rejected. ` +
      `Original: ${url.substring(0, 100)}... ` +
      `Sanitized: ${sanitized.substring(0, 100)}...`
    )
  }
}

/**
 * Sanitizes a slug to ensure it doesn't contain personal information
 */
export function sanitizeSlug(slug: string): string {
  let sanitized = slug.toLowerCase()
  
  // Remove any email-like patterns
  sanitized = sanitized.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '')
  
  // Remove personal keywords
  for (const keyword of PERSONAL_KEYWORDS) {
    const regex = new RegExp(`\\b${keyword}\\b`, 'gi')
    sanitized = sanitized.replace(regex, '')
  }
  
  // Clean up any double dashes or trailing dashes
  sanitized = sanitized.replace(/-+/g, '-').replace(/^-+|-+$/g, '')
  
  return sanitized || 'sanitized-slug'
}

