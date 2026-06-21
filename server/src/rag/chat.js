import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { getVectorStore } from "./vectorStore.js";
import { ragPrompt } from "./prompt.js";
import dotenv from "dotenv";

dotenv.config();

const apiKey = process.env.GOOGLE_API_KEY;

if (!apiKey) {
  throw new Error("Missing GOOGLE_API_KEY environment variable.");
}

// Initialize the ChatGoogleGenerativeAI model gemini-flash-latest
export const chatModel = new ChatGoogleGenerativeAI({
  model: "gemini-flash-latest",
  apiKey: apiKey,
  temperature: 0, // Keep temperature 0 for factual grounding
});

/**
 * Rephrases a follow-up question into a standalone question using chat history.
 */
async function condenseQuestion(question, history) {
  if (!history || history.length === 0) {
    return question;
  }

  const formattedHistory = history
    .map(msg => `${msg.sender === 'user' ? 'User' : 'Assistant'}: ${msg.text}`)
    .join('\n');

  const condensePrompt = `Given the following conversation history and a follow-up question, rephrase the follow-up question to be a standalone question (in English). If the follow-up question is already a standalone question or does not refer to the history, return it exactly as it is. Do not answer the question, just return the rephrased standalone question.

Chat History:
${formattedHistory}

Follow-up Question:
${question}

Standalone Question:`;

  try {
    const response = await chatModel.invoke(condensePrompt);
    const rephrased = response.content.trim();
    console.log(`[Condenser] Rephrased "${question}" -> "${rephrased}"`);
    return rephrased;
  } catch (err) {
    console.error("[Condenser] Failed to rephrase query, using original question:", err.message);
    return question;
  }
}

/**
 * Runs the Chroma-based RAG pipeline to answer a user's question, supporting chat history.
 * 
 * @param {string} question - The user's input question
 * @param {Array} history - Array of previous chat messages
 * @returns {Promise<{answer: string, sources: Array<{title: string, url: string}>}>}
 */
export async function queryRAG(question, history = []) {
  const vectorStore = await getVectorStore();

  // 1. Condense follow-up question if history exists
  const searchQuery = await condenseQuestion(question, history);

  // 2. Retrieve the top 15 relevant documents from Chroma
  const retrievedDocs = await vectorStore.similaritySearch(searchQuery, 15);

  // 3. Format context for prompt template (Title, URL, and Content)
  const contextText = retrievedDocs
    .map(doc => `Title: ${doc.metadata?.title || 'Untitled'}\nSource URL: ${doc.metadata?.source || 'No URL'}\nContent: ${doc.pageContent}`)
    .join('\n\n');

  // 4. Format chat history for prompt template
  const formattedHistory = history.length > 0
    ? history.map(msg => `${msg.sender === 'user' ? 'User' : 'Assistant'}: ${msg.text}`).join('\n')
    : "No previous conversation.";

  // 5. Format prompt with context, history, and condensed question
  const formattedPrompt = await ragPrompt.format({
    context: contextText,
    history: formattedHistory,
    question: searchQuery,
  });

  // 6. Generate answer from Gemini
  const response = await chatModel.invoke(formattedPrompt);

  // 7. Extract unique sources used for retrieval
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
