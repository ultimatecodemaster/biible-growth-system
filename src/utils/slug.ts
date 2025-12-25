import { sanitizeSlug, containsPersonalInfo } from './personal-info-sanitizer.js'

/**
 * Creates a URL-friendly slug from a query string
 * Automatically sanitizes personal information to prevent exposure
 */
export function createSlug(query: string): string {
  console.log(`[Slug] Creating slug from query: ${query}`)
  
  // Check if query itself contains personal info
  if (containsPersonalInfo(query)) {
    console.warn(`[Slug] WARNING: Query contains personal information: ${query}`)
  }
  
  let slug = query
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  
  // Sanitize to remove any personal information that might have slipped through
  slug = sanitizeSlug(slug)
  
  console.log(`[Slug] Generated slug: ${slug}`)
  
  return slug
}

