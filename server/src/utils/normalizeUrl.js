import { URL } from 'url';

/**
 * Normalizes a URL to ensure consistency in crawling and duplicate detection.
 * @param {string} urlStr - The raw URL string.
 * @param {string} baseUrlStr - The base URL (useful for relative link resolution).
 * @returns {string|null} The normalized URL string, or null if invalid.
 */
export function normalizeUrl(urlStr, baseUrlStr) {
  try {
    const base = baseUrlStr ? new URL(baseUrlStr) : undefined;
    const url = new URL(urlStr, base);
    
    // Remove hash/anchor tags
    url.hash = '';
    
    // Normalize path (remove trailing slash for consistency, except for root)
    if (url.pathname.endsWith('/') && url.pathname.length > 1) {
      url.pathname = url.pathname.slice(0, -1);
    }
    
    return url.toString();
  } catch (error) {
    return null;
  }
}
