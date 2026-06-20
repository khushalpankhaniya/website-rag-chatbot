/**
 * Removes unwanted HTML elements and extracts clean, trimmed text content.
 * @param {object} $ - The Cheerio selector function.
 * @returns {string} Cleaned text content.
 */
export function cleanContent($) {
  // Remove unwanted elements
  $('script, style, nav, footer, noscript, iframe, header').remove();

  // Extract text and clean up whitespace/newlines
  const text = $('body').text() || $('html').text();

  return text
    .replace(/\s+/g, ' ') // Replace multiple spaces/newlines with a single space
    .trim();
}
