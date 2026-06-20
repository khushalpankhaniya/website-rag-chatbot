import { queryRAG } from "../rag/chat.js";

/**
 * Controller to handle POST /api/chat.
 * Processes the user's question, queries the pgvector store for similar chunks,
 * passes the content to the Gemini chat model, and returns the formulated answer and sources.
 * 
 * Request schema:
 * {
 *   "question": "What services does the company provide?"
 * }
 */
export async function chatQuery(req, res) {
  try {
    const { question } = req.body;

    if (!question || typeof question !== "string" || question.trim() === "") {
      return res.status(400).json({
        error: "Missing or invalid 'question' in request body. It must be a non-empty string."
      });
    }

    console.log(`Received question: "${question}"`);

    // Call the queryRAG service to handle search and chat model invocation
    const result = await queryRAG(question);

    res.json(result);
  } catch (error) {
    console.error("Error in chatQuery controller:", error);
    res.status(500).json({
      error: "Internal server error during answer generation.",
      details: error.message
    });
  }
}
