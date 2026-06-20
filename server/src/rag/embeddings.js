import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import dotenv from "dotenv";

dotenv.config();

const apiKey = process.env.GOOGLE_API_KEY;

if (!apiKey) {
  throw new Error("Missing GOOGLE_API_KEY environment variable.");
}

// Initialize the Google Generative AI Embeddings model 'embedding-001' (768 dimensions)
export const embeddings = new GoogleGenerativeAIEmbeddings({
  model: "gemini-embedding-001",
  apiKey: apiKey,
});
