import axios from 'axios';
import * as cheerio from 'cheerio';
import { URL } from 'url';
import robotsParser from 'robots-parser';
import { normalizeUrl } from '../utils/normalizeUrl.js';
import { cleanContent } from '../utils/cleanContent.js';
import { extractLinks } from '../utils/extractLinks.js';

// Helper to pause execution (rate limiting)
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export class CrawlerService {
  /**
   * Crawls a starting URL using a BFS queue strategy.
   * @param {string} startUrl - The starting URL of the crawl.
   * @returns {Promise<{totalPages: number, pages: Array}>} Crawled pages.
   */
  static async crawl(startUrl) {
    let normalizedStart = normalizeUrl(startUrl);
    if (!normalizedStart) {
      normalizedStart = normalizeUrl('https://' + startUrl);
    }
    if (!normalizedStart) {
      throw new Error('Invalid starting URL');
    }

    let startDomain;
    try {
      startDomain = new URL(normalizedStart).hostname;
    } catch (err) {
      throw new Error('Failed to parse domain from URL');
    }

    // 1. Fetch the robots.txt file from the root of the given domain
    // Example: if URL is https://posimyth.com/about, fetch https://posimyth.com/robots.txt
    let robotsObj = null;
    try {
      const startUrlObj = new URL(normalizedStart);
      const robotsUrl = `${startUrlObj.protocol}//${startUrlObj.host}/robots.txt`;
      console.log(`[Crawler] Fetching robots.txt from: ${robotsUrl}`);
      
      const robotsResponse = await axios.get(robotsUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        },
        timeout: 5000
      });

      if (robotsResponse.status === 200 && typeof robotsResponse.data === 'string' && !robotsResponse.data.trim().startsWith('<')) {
        // 2. Parse the robots.txt rules assuming User-agent: *
        robotsObj = robotsParser(robotsUrl, robotsResponse.data);
        console.log(`[Crawler] Successfully parsed robots.txt rules.`);
      } else if (robotsResponse.data && robotsResponse.data.trim().startsWith('<')) {
        console.log(`[Crawler] robots.txt response returned HTML content. Assuming all pages are allowed.`);
      }
    } catch (err) {
      // 5. If robots.txt does not exist or returns an error -> assume all pages are allowed and continue crawling normally. Do not crash.
      console.log(`[Crawler] robots.txt not found or could not be parsed: ${err.message}. Assuming all pages are allowed.`);
    }

    const maxPages = 20;
    const maxDepth = 2;
    const requestDelay = 500; // ms

    const visited = new Set();
    const results = [];

    // Queue structure: Array of { url: string, depth: number }
    const queue = [{ url: normalizedStart, depth: 0 }];

    // Keep track of URLs added to the queue to avoid redundant queuing
    const queued = new Set([normalizedStart]);

    while (queue.length > 0) {
      // Stop if we reached the maximum page count limit
      if (results.length >= maxPages) {
        break;
      }

      const current = queue.shift();

      // Stop processing current path if depth exceeds limit
      if (current.depth > maxDepth) {
        continue;
      }

      // Skip if already visited
      if (visited.has(current.url)) {
        continue;
      }

      // 3. Before visiting ANY page in the crawler queue, check if that URL is allowed by robots.txt
      // - If the URL matches a Disallow rule -> skip it, do not crawl
      // - If the URL is allowed (or robots.txt is missing) -> crawl it normally
      if (robotsObj && !robotsObj.isAllowed(current.url, '*')) {
        console.log(`[Crawler] Skipping disallowed URL by robots.txt: ${current.url}`);
        continue;
      }

      // Mark as visited
      visited.add(current.url);

      // Rate limit: delay 500ms before making the request (except for the very first page)
      if (results.length > 0) {
        await delay(requestDelay);
      }

      try {
        console.log(`[Crawler] Fetching: ${current.url} (Depth: ${current.depth}, Count: ${results.length + 1})`);

        const response = await axios.get(current.url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Cache-Control': 'max-age=0',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Chua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
            'Sec-Chua-Mobile': '?0',
            'Sec-Chua-Platform': '"Windows"',
          },
          timeout: 8000 // 8 seconds timeout
        });

        // Ensure we only parse HTML content
        const contentType = response.headers['content-type'] || '';
        if (!contentType.includes('text/html')) {
          console.warn(`[Crawler] Skipping non-HTML page: ${current.url} (${contentType})`);
          continue;
        }

        const html = response.data;
        const $ = cheerio.load(html);

        // Extract metadata
        const title = $('title').text().trim() || $('meta[property="og:title"]').attr('content') || 'No Title';
        const content = cleanContent($);
        const internalLinks = extractLinks($, current.url, startDomain);
        // Add page details to results
        results.push({
          title,
          url: current.url,
          content,
          links: internalLinks
        });

        // Queue internal links if we haven't hit page/depth limits
        if (current.depth < maxDepth && results.length < maxPages) {
          for (const link of internalLinks) {
            if (!queued.has(link) && !visited.has(link)) {
              queued.add(link);
              queue.push({ url: link, depth: current.depth + 1 });
            }
          }
        }
      } catch (err) {
        console.error(`[Crawler] Failed to fetch ${current.url}: ${err.message}`);
        // Continue to next page rather than crashing the crawl
      }
    }

    return {
      totalPages: results.length,
      pages: results
    };
  }
}
