import { CrawlerService } from '../services/crawler.service.js';
import { splitContent } from '../rag/splitter.js';
import { getVectorStore } from '../rag/vectorStore.js';

/**
 * Endpoint controller to handle page crawling request requests.
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 */
export async function crawlWebsite(req, res) {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({
      success: false,
      error: 'URL is required in request body'
    });
  }

  try {
    const result = await CrawlerService.crawl(url);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'An error occurred during crawling'
    });
  }
}

/**
 * Endpoint controller to handle scraped webpage content indexing.
 * Receives crawled page objects, chunks them, generates vector embeddings,
 * and stores them inside the ChromaDB "website-rag" collection.
 * 
 * Request schema:
 * {
 *   "pages": [
 *     {
 *       "url": "https://example.com",
 *       "title": "Example",
 *       "content": "Cleaned page content..."
 *     }
 *   ]
 * }
 */
export async function indexContent(req, res) {
  try {
    const { pages } = req.body;

    if (!pages || !Array.isArray(pages)) {
      return res.status(400).json({ 
        success: false, 
        error: "Missing or invalid 'pages' array in request body." 
      });
    }

    const allDocuments = [];

    // Chunks content and registers metadata for each page
    for (const page of pages) {
      const { url, title, content } = page;
      
      if (!url || !content) {
        continue; // Skip invalid records
      }

      const docs = await splitContent(content, url, title || "Untitled Page");
      allDocuments.push(...docs);
    }

    if (allDocuments.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: "No valid content chunks found to index. Ensure url and content are provided for each page." 
      });
    }

    console.log(`Indexing ${allDocuments.length} document chunks into ChromaDB...`);

    // Fetch Chroma vector store and store documents
    const vectorStore = await getVectorStore();
    await vectorStore.addDocuments(allDocuments);

    console.log(`Successfully stored ${allDocuments.length} chunks inside Chroma.`);

    res.json({
      success: true,
      chunksStored: allDocuments.length
    });
  } catch (error) {
    console.error("Error in indexContent controller:", error);
    res.status(500).json({ 
      success: false, 
      error: "Internal server error during document indexing.",
      details: error.message 
    });
  }
}
