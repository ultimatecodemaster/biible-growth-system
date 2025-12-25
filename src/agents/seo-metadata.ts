import { readFileSync, writeFileSync } from 'fs'
import { ensureDirSync } from 'fs-extra'
import { join } from 'path'
import { callLLM } from '../llm/client.js'
import { loadPrompt, formatPrompt } from '../llm/prompts.js'
import { SEOMetadataSchema } from '../schemas.js'
import { validateUrlForPersonalInfo, containsPersonalInfo } from '../utils/personal-info-sanitizer.js'
import type { VerseMap } from '../schemas.js'

export interface SEOAgentResult {
  metadata: any
  frontmatter: string
  structuredDataJson: string
}

export async function runSEOMetadata(
  query: string,
  verseMap: VerseMap,
  mdxContent: string,
  slug: string
): Promise<SEOAgentResult> {
  console.log(`[SEO Metadata] Generating SEO metadata for: ${query}`)
  
  const promptTemplate = loadPrompt('seo_metadata')
  const verseMapJson = JSON.stringify(verseMap, null, 2)
  
  // Extract intro from MDX content for structured data
  const introMatch = mdxContent.match(/#\s+.+\n\n(.+?)(?=\n\n|##|$)/s)
  const introText = introMatch ? introMatch[1].substring(0, 200) : ''
  
  const prompt = `${formatPrompt(promptTemplate, { query })}\n\nVerse Map Data:\n${verseMapJson}\n\nMDX Content:\n${mdxContent}\n\nIntro Text (for structured data):\n${introText}`
  
  const response = await callLLM('seo_metadata', prompt)
  
  console.log(`[SEO Metadata] Received response, parsing JSON...`)
  
  // Extract JSON from response
  let metadata
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found in response')
    }
    
    const jsonStr = jsonMatch[0]
    const parsed = JSON.parse(jsonStr)
    metadata = SEOMetadataSchema.parse(parsed)
    
    // Validate URLs for personal information BEFORE using them
    console.log(`[SEO Metadata] Validating URLs for personal information...`)
    if (containsPersonalInfo(metadata.canonicalUrl)) {
      console.error(`[SEO Metadata] ERROR: canonicalUrl contains personal information: ${metadata.canonicalUrl}`)
      throw new Error(`Canonical URL contains personal information: ${metadata.canonicalUrl}`)
    }
    if (containsPersonalInfo(metadata.ogUrl)) {
      console.error(`[SEO Metadata] ERROR: ogUrl contains personal information: ${metadata.ogUrl}`)
      throw new Error(`OG URL contains personal information: ${metadata.ogUrl}`)
    }
    
    // Validate all URLs in structured data
    const structuredDataStr = JSON.stringify(metadata.structuredData)
    if (containsPersonalInfo(structuredDataStr)) {
      console.error(`[SEO Metadata] ERROR: Structured data contains personal information`)
      throw new Error(`Structured data contains personal information`)
    }
    
    console.log(`[SEO Metadata] URLs validated - no personal information detected`)
  } catch (error) {
    console.error(`[SEO Metadata] Failed to parse response`, error)
    console.error(`[SEO Metadata] Response was:`, response.substring(0, 500))
    throw new Error(`Failed to parse SEO metadata: ${error}`)
  }
  
  // Ensure canonical URL uses correct slug (hardcoded base URL - never use user info)
  const baseUrl = 'https://biible-content-site.vercel.app'
  metadata.canonicalUrl = `${baseUrl}/questions/${slug}`
  metadata.ogUrl = `${baseUrl}/questions/${slug}`
  
  // Final validation after setting URLs
  validateUrlForPersonalInfo(metadata.canonicalUrl)
  validateUrlForPersonalInfo(metadata.ogUrl)
  
  console.log(`[SEO Metadata] Final URLs set: canonicalUrl=${metadata.canonicalUrl}, ogUrl=${metadata.ogUrl}`)
  
  // Generate YAML frontmatter
  const frontmatter = generateFrontmatter(metadata, query)
  
  // Generate structured data JSON-LD
  const structuredDataJson = generateStructuredDataJSON(metadata, query, introText, slug)
  
  // Save structured data JSON file
  const dataDir = join(process.cwd(), 'data', 'drafts')
  ensureDirSync(dataDir)
  const structuredDataPath = join(dataDir, `${slug}.structured-data.json`)
  writeFileSync(structuredDataPath, structuredDataJson, 'utf-8')
  console.log(`[SEO Metadata] Saved structured data to ${structuredDataPath}`)
  
  console.log(`[SEO Metadata] Generated SEO metadata for: ${query}`)
  
  return {
    metadata,
    frontmatter,
    structuredDataJson
  }
}

function generateFrontmatter(metadata: any, query: string): string {
  const lines = [
    '---',
    `title: "${query.replace(/"/g, '\\"')}"`,
    `metaTitle: "${metadata.metaTitle.replace(/"/g, '\\"')}"`,
    `metaDescription: "${metadata.metaDescription.replace(/"/g, '\\"')}"`,
    `canonicalUrl: "${metadata.canonicalUrl}"`,
    `ogTitle: "${metadata.ogTitle.replace(/"/g, '\\"')}"`,
    `ogDescription: "${metadata.ogDescription.replace(/"/g, '\\"')}"`,
    `ogType: "${metadata.ogType}"`,
    `ogUrl: "${metadata.ogUrl}"`,
    `twitterCard: "${metadata.twitterCard}"`,
    `twitterTitle: "${metadata.twitterTitle.replace(/"/g, '\\"')}"`,
    `twitterDescription: "${metadata.twitterDescription.replace(/"/g, '\\"')}"`,
    `author: "${metadata.author}"`,
    `publishedDate: "${metadata.publishedDate}"`,
    `lastUpdated: "${metadata.lastUpdated}"`,
    `tags: [${metadata.tags.map((t: string) => `"${t}"`).join(', ')}]`,
    `cluster: "${metadata.cluster}"`,
    '---'
  ]
  
  return lines.join('\n')
}

function generateStructuredDataJSON(metadata: any, query: string, introText: string, slug: string): string {
  const baseUrl = 'https://biible-content-site.vercel.app'
  
  // FAQPage Schema
  const faqPage = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: {
      '@type': 'Question',
      name: query,
      acceptedAnswer: {
        '@type': 'Answer',
        text: introText || metadata.metaDescription
      }
    }
  }
  
  // Article Schema
  const article = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: query,
    description: metadata.metaDescription,
    author: {
      '@type': 'Organization',
      name: 'Biible.net'
    },
    publisher: {
      '@type': 'Organization',
      name: 'Biible.net'
    },
    datePublished: metadata.publishedDate,
    dateModified: metadata.lastUpdated
  }
  
  // BreadcrumbList Schema
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: baseUrl
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: metadata.cluster.charAt(0).toUpperCase() + metadata.cluster.slice(1),
        item: `${baseUrl}/topics/${metadata.cluster}`
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: query,
        item: metadata.canonicalUrl
      }
    ]
  }
  
  // Combine all structured data
  const combined = {
    faqPage,
    article,
    breadcrumb
  }
  
  return JSON.stringify(combined, null, 2)
}

export function injectFrontmatterIntoMDX(mdxContent: string, frontmatter: string): string {
  // Check if frontmatter already exists
  if (mdxContent.trim().startsWith('---')) {
    // Remove existing frontmatter
    const frontmatterEnd = mdxContent.indexOf('---', 3)
    if (frontmatterEnd !== -1) {
      mdxContent = mdxContent.substring(frontmatterEnd + 3).trim()
    }
  }
  
  // Inject new frontmatter
  return `${frontmatter}\n\n${mdxContent}`
}

