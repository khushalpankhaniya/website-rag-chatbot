import { getVectorStore } from "./vectorStore.js";

/**
 * Returns a LangChain retriever configured for similarity search with top-K = 5.
 * 
 * Flow:
 * Question -> Query Embedding -> Vector Search -> Top 5 Relevant Chunks
 * 
 * @returns {Promise<any>} - LangChain Vector Store Retriever
 */
export async function getRetriever() {
  const vectorStore = await getVectorStore();
  
  // Set searchType to similarity and k to 5 (top 5 relevant chunks)
  return vectorStore.asRetriever({
    searchType: "similarity",
    k: 5
  });
}
