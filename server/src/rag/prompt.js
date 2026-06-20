import { PromptTemplate } from "@langchain/core/prompts";

// RAG Prompt Template matching specified instructions
export const ragPrompt = PromptTemplate.fromTemplate(`You are a website assistant.

Answer ONLY using the provided context.

If the answer is not present in the context, respond:
"I couldn't find that information on the crawled website."

Always provide source URLs used for the answer.

Context:
{context}

Question:
{question}`);
