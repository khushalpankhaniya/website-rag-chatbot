import { URL } from 'url';
import { normalizeUrl } from './normalizeUrl.js';

/**
 * Extracts and filters internal links from a parsed HTML page.
 * @param {object} $ - The Cheerio selector function.
 * @param {string} currentUrl - The URL of the page being crawled.
 * @param {string} startDomain - The host domain to lock the crawler inside.
 * @returns {string[]} List of unique, normalized internal URLs.
 */
export function extractLinks($, currentUrl, startDomain) {
  const linksSet = new Set();
  $('a').each((_, element) => {
    const href = $(element).attr('href');
    if (!href) return;
    const normalized = normalizeUrl(href, currentUrl);
    if (!normalized) return;

    try {
      const urlObj = new URL(normalized);
      // Ensure it stays within the same domain (e.g., example.com)
      if (urlObj.hostname === startDomain) {
        linksSet.add(normalized);
      }
    } catch (e) {
      // Ignore invalid URLs
    }
  });

  console.log(Array.from(linksSet));

  return Array.from(linksSet);
}
