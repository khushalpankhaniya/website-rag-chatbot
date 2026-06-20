import { Router } from "express";
import { chatQuery } from "../controllers/chat.controller.js";

const router = Router();

// Endpoint: POST /api/chat
// Purpose: Execute RAG queries and return Gemini-generated answers with unique sources
router.post("/chat", chatQuery);

export default router;
