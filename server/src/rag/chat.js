import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { getVectorStore } from "./vectorStore.js";
import { ragPrompt } from "./prompt.js";
import dotenv from "dotenv";

dotenv.config();

const apiKey = process.env.GOOGLE_API_KEY;

if (!apiKey) {
  throw new Error("Missing GOOGLE_API_KEY environment variable.");
}

// Initialize the ChatGoogleGenerativeAI model gemini-2.5-flash
export const chatModel = new ChatGoogleGenerativeAI({
  model: "gemini-2.5-flash",
  apiKey: apiKey,
  temperature: 0, // Keep temperature 0 for factual grounding
});

/**
 * Runs the Chroma-based RAG pipeline to answer a user's question.
 * 
 * Flow:
 * 1. Retrieve top 5 relevant document chunks from Chroma
 * 2. Format context: Title, URL, and Content
 * 3. Render prompt with context and question
 * 4. Generate answer using gemini-2.5-flash
 * 5. Extract unique sources (Title, URL)
 * 
 * @param {string} question - The user's input question
 * @returns {Promise<{answer: string, sources: Array<{title: string, url: string}>}>}
 */
export async function queryRAG(question) {
  const vectorStore = await getVectorStore();

  // 1. Retrieve the top 15 relevant documents from Chroma
  const retrievedDocs = await vectorStore.similaritySearch(question, 15);

  // 2. Format context for prompt template (Title, URL, and Content)
  const contextText = retrievedDocs
    .map(doc => `Title: ${doc.metadata?.title || 'Untitled'}\nSource URL: ${doc.metadata?.source || 'No URL'}\nContent: ${doc.pageContent}`)
    .join('\n\n');

  // 3. Format prompt with context and question
  const formattedPrompt = await ragPrompt.format({
    context: contextText,
    question: question,
  });

  // 4. Generate answer from Gemini
  const response = await chatModel.invoke(formattedPrompt);

  // 5. Extract unique sources used for retrieval
  const sources = [];
  const seenUrls = new Set();

  for (const doc of retrievedDocs) {
    const url = doc.metadata?.source;
    if (url && !seenUrls.has(url)) {
      seenUrls.add(url);
      sources.push({
        title: doc.metadata?.title || 'Untitled',
        url: url,
      });
    }
  }

  return {
    answer: response.content,
    sources,
  };
}
