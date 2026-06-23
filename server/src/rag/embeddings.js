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
 * Recursively embeds a batch of documents. If rate limits are encountered
 * (detected by empty embeddings returned by the library or an error), the batch is split
 * in half and processed sequentially with an adaptive delay.
 */
async function embedBatchWithSplit(batch, currentDelay = 3000, maxRetries = 5) {
  let attempt = 0;
  while (attempt < maxRetries) {
    console.log(`[Rate Limiter] Embedding batch of ${batch.length} documents (Attempt ${attempt + 1}/${maxRetries})...`);
    
    try {
      const batchEmbeds = await originalEmbedDocuments(batch);
      
      // The @langchain/google-genai library catches failures internally and returns empty arrays for failed items.
      const hasEmpty = batchEmbeds.some(emb => !emb || emb.length === 0);
      
      if (!hasEmpty) {
        return batchEmbeds;
      }
      
      console.warn(`[Rate Limiter] Rate limit hit (empty embeddings returned).`);
    } catch (err) {
      console.warn(`[Rate Limiter] Error during embedding call: ${err.message}`);
    }
    
    // If rate limit hit and batch has multiple documents, split in half
    if (batch.length > 1) {
      const mid = Math.floor(batch.length / 2);
      const firstHalf = batch.slice(0, mid);
      const secondHalf = batch.slice(mid);
      
      const splitDelay = Math.max(currentDelay * 2, 4000);
      console.log(`[Rate Limiter] Splitting batch of ${batch.length} into two smaller batches of ${firstHalf.length} and ${secondHalf.length}...`);
      console.log(`[Rate Limiter] Waiting ${(splitDelay / 1000).toFixed(1)}s before running first sub-batch...`);
      await new Promise(resolve => setTimeout(resolve, splitDelay));
      
      const firstEmbeds = await embedBatchWithSplit(firstHalf, splitDelay, maxRetries);
      
      console.log(`[Rate Limiter] Waiting ${(splitDelay / 1000).toFixed(1)}s before running second sub-batch...`);
      await new Promise(resolve => setTimeout(resolve, splitDelay));
      
      const secondEmbeds = await embedBatchWithSplit(secondHalf, splitDelay, maxRetries);
      
      return [...firstEmbeds, ...secondEmbeds];
    }
    
    // If it's a single document batch that failed, retry with exponential backoff
    attempt++;
    if (attempt < maxRetries) {
      const backoffDelay = Math.pow(2, attempt) * 4000 + Math.random() * 1000;
      console.warn(`[Rate Limiter] Single document embed failed. Retrying in ${(backoffDelay / 1000).toFixed(1)} seconds...`);
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
    }
  }
  throw new Error(`Failed to generate embeddings even after splitting down to single documents due to rate limits or API quota exhaustion.`);
}

// Wrap the embedDocuments method to enforce batching, baseline delay, and dynamic splits.
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
    
    const batchEmbeds = await embedBatchWithSplit(batch, 3000);
    results.push(...batchEmbeds);
  }
  
  return results;
};

export const embeddings = baseEmbeddings;
