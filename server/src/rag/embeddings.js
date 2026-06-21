import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import dotenv from "dotenv";

dotenv.config();

const apiKey = process.env.GOOGLE_API_KEY;

if (!apiKey) {
  throw new Error("Missing GOOGLE_API_KEY environment variable.");
}

// Initialize the Google Generative AI Embeddings model 'gemini-embedding-2'
const baseEmbeddings = new GoogleGenerativeAIEmbeddings({
  model: "gemini-embedding-2",
  apiKey: apiKey,
});

// Cache the original embedDocuments method
const originalEmbedDocuments = baseEmbeddings.embedDocuments.bind(baseEmbeddings);

/**
 * Helper to embed a batch of documents with retries and exponential backoff
 * when rate limits are hit (detected by empty embeddings returned by the library).
 */
async function embedBatchWithRetry(batch, maxRetries = 5) {
  let attempt = 0;
  while (attempt < maxRetries) {
    console.log(`[Rate Limiter] Embedding batch of ${batch.length} documents (Attempt ${attempt + 1}/${maxRetries})...`);
    const batchEmbeds = await originalEmbedDocuments(batch);
    
    // The @langchain/google-genai library catches failures internally and returns empty arrays for failed items.
    const hasEmpty = batchEmbeds.some(emb => !emb || emb.length === 0);
    
    if (!hasEmpty) {
      return batchEmbeds;
    }
    
    attempt++;
    if (attempt < maxRetries) {
      // Exponential backoff: 4s, 8s, 16s, 32s...
      const delay = Math.pow(2, attempt) * 2000 + Math.random() * 1000;
      console.warn(`[Rate Limiter] Rate limit hit (empty embeddings returned). Retrying in ${(delay / 1000).toFixed(1)} seconds...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error(`Failed to generate embeddings after ${maxRetries} attempts due to rate limits or API quota exhaustion.`);
}

// Wrap the embedDocuments method to enforce batching, baseline delay, and retries.
baseEmbeddings.embedDocuments = async function(documents) {
  const batchSize = 20;
  const results = [];
  
  for (let i = 0; i < documents.length; i += batchSize) {
    const batch = documents.slice(i, i + batchSize);
    
    if (i > 0) {
      // 3.0 seconds baseline delay between successive batches to stay below the 15 RPM rate limit.
      console.log(`[Rate Limiter] Waiting 3.0 seconds baseline delay between batches...`);
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    const batchEmbeds = await embedBatchWithRetry(batch);
    results.push(...batchEmbeds);
  }
  
  return results;
};

export const embeddings = baseEmbeddings;
