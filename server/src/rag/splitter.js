import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { Document } from "@langchain/core/documents";

// Initialize the recursive character text splitter with the specified configurations
const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,
  chunkOverlap: 200,
});

/**
 * Splits page content into text chunks and wraps them in LangChain Document objects
 * with source URL and title metadata.
 * 
 * @param {string} content - The cleaned text content of the page
 * @param {string} pageUrl - The source URL of the page
 * @param {string} pageTitle - The title of the page
 * @returns {Promise<Document[]>} - Array of LangChain Document objects
 */
export async function splitContent(content, pageUrl, pageTitle) {
  if (!content) return [];
  
  // Split the raw text content into strings
  const chunks = await splitter.splitText(content);
  
  // Map chunks into Document instances with required metadata keys
  return chunks.map(chunk => new Document({
    pageContent: chunk,
    metadata: {
      source: pageUrl,
      title: pageTitle || 'Untitled'
    }
  }));
}
