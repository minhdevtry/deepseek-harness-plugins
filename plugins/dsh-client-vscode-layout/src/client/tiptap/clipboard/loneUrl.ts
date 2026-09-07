/**
 * Lone URL detection utilities for clipboard operations.
 * Allows pasting a standalone URL over an existing text selection to linkify it,
 * matching Notion and OpenKnowledge UX conventions.
 */

const EXPLICIT_SCHEME = /^[a-z][a-z0-9+.-]*:/i

function loneToken(raw: string): string | null {
  const token = raw.trim()
  if (!token || /\s/.test(token)) return null
  return token
}

/**
 * Checks if a URI protocol is safe to linkify (http, https, mailto, tel).
 */
export function isAllowedLinkUri(uri: string): boolean {
  try {
    const parsed = new URL(uri)
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(parsed.protocol.toLowerCase())
  } catch {
    return false
  }
}

/**
 * Detects whether a string is a single standalone URL.
 * Automatically normalizes bare domain tokens (e.g. "example.com/page") to "https://...".
 */
export function detectLoneTrustedUrl(raw: string): string | null {
  const token = loneToken(raw)
  if (!token) return null

  if (EXPLICIT_SCHEME.test(token)) {
    return isAllowedLinkUri(token) ? token : null
  }

  // Check if it's a bare domain e.g. "github.com" or "example.org/path"
  const host = token.split(/[/?#]/, 1)[0] ?? ''
  if (host.includes('@')) return null
  if (!host.includes('.') || host.startsWith('.') || host.endsWith('.')) return null

  const href = `https://${token}`
  return isAllowedLinkUri(href) ? href : null
}

/**
 * Detects if a token is a valid GFM URL.
 */
export function detectLoneGfmUrl(raw: string): string | null {
  return detectLoneTrustedUrl(raw)
}
