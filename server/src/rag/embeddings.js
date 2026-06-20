import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import dotenv from "dotenv";

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

if (!apiKey) {
  throw new Error("Missing GEMINI_API_KEY or GOOGLE_API_KEY environment variables.");
}

// Initialize the Google Generative AI Embeddings model 'embedding-001' (768 dimensions)
export const embeddings = new GoogleGenerativeAIEmbeddings({
  model: "embedding-001",
  apiKey: apiKey,
});
