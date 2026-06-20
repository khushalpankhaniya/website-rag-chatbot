import { getVectorStore } from "./vectorStore.js";

/**
 * Returns a LangChain retriever configured for similarity search with top-K = 15.
 * 
 * Flow:
 * Question -> Query Embedding -> Vector Search -> Top 15 Relevant Chunks
 * 
 * @returns {Promise<any>} - LangChain Vector Store Retriever
 */
export async function getRetriever() {
  const vectorStore = await getVectorStore();

  // Set searchType to similarity and k to 15 (top 15 relevant chunks)
  return vectorStore.asRetriever({
    searchType: "similarity",
    k: 15
  });
}
