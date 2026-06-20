import { Chroma } from "@langchain/community/vectorstores/chroma";
import { embeddings } from "./embeddings.js";
import dotenv from "dotenv";

dotenv.config();

// Cached instance of the Chroma vector store
let vectorStoreInstance = null;

/**
 * Initializes and returns the Chroma vector store instance.
 * Sets the collection name to "website-rag" and connects to the Chroma server.
 * 
 * @returns {Promise<Chroma>} - Initialized Chroma vector store instance
 */
export async function getVectorStore() {
  if (vectorStoreInstance) {
    return vectorStoreInstance;
  }

  // Initialize Chroma vector store connecting to the local or remote Chroma instance
  vectorStoreInstance = new Chroma(embeddings, {
    collectionName: "website-rag",
    url: process.env.CHROMA_URL || "http://localhost:8000",
  });

  return vectorStoreInstance;
}
