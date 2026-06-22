import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import { embeddings } from "./embeddings.js";

// Cached instance of the Memory vector store
let vectorStoreInstance = null;

/**
 * Initializes and returns the Memory vector store instance.
 * 
 * @returns {Promise<MemoryVectorStore>} - Initialized Memory vector store instance
 */
export async function getVectorStore() {
  if (vectorStoreInstance) {
    return vectorStoreInstance;
  }

  // Initialize Memory vector store
  vectorStoreInstance = new MemoryVectorStore(embeddings);

  return vectorStoreInstance;
}
