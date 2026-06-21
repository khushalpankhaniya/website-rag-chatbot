# Website RAG Chatbot

An intelligent Retrieval-Augmented Generation (RAG) chatbot that allows users to crawl any website, index its content into a vector database, and hold grounded conversations about the site's contents using Google's Gemini LLM.

---

## Tech Stack
* **Frontend:** React, Vite, Tailwind CSS (Custom Dark Theme)
* **Backend:** Node.js, Express, Axios, Cheerio, robots-parser
* **Vector Store:** Chroma DB
* **LLM & Embeddings:** Google Gemini (`gemini-flash-latest` and `gemini-embedding-2`) via `@langchain/google-genai` and `@langchain/community`

---

## How to Run

### Prerequisite Environment Variables
Create a `.env` file inside the `/server` directory and define the following variables:
```env
PORT=5000
GOOGLE_API_KEY=YOUR_GEMINI_API_KEY
CHROMA_URL=http://localhost:8000
```
*(Get your API key from [Google AI Studio](https://aistudio.google.com/))*

### Step-by-Step Setup

#### Step 1: Start Chroma DB
Chroma must be installed and run locally. (Requires Python).
```bash
# Install Chroma
pip install chromadb

# Start Chroma DB local server
chroma run --path ./chroma --port 8000
```

#### Step 2: Start the Backend Server
```bash
cd server
npm install
npm run dev
```
*Backend runs on: [http://localhost:5000](http://localhost:5000)*

#### Step 3: Start the Frontend Client
```bash
cd client
npm install
npm run dev
```
*Frontend runs on: [http://localhost:5173](http://localhost:5173)*

---

## Architectural Details

### 1. Crawling Strategy
* **Queue Strategy:** Utilizes a Breadth-First Search (BFS) queue starting from a normalized URL.
* **Scope Control:** Restricts crawls strictly to the same starting hostname (preventing the crawler from wandering onto external domains).
* **Robots.txt Adherence:** Automatically constructs the URL to fetch `robots.txt` from the domain root before visiting pages. Uses the `robots-parser` package to skip any disallowed paths under the `*` user agent rules. If `robots.txt` is missing or fails, it falls back to crawling all paths.
* **Politeness & Rate Limits:** Capped at a maximum depth of `2` and a maximum of `20` pages. Implements a mandatory `500ms` delay between requests to prevent hitting rate limits or spamming target servers.

### 2. Content Cleaning & Extraction
To keep indexed chunks clean and highly relevant:
* Strips boilerplate markup tags: `<script>`, `<style>`, `<nav>`, `<footer>`, `<noscript>`, and known cookie consent banners.
* Retains only primary text content from HTML tags.
* Normalizes URLs (collapsing slashes, removing query params and hashes) to guarantee unique page indexing.

### 3. Chunking & Embeddings
* **Splitting:** Uses LangChain's `RecursiveCharacterTextSplitter` to cut cleaned text into overlapping chunks of `1000` characters (with `200` characters overlap) to preserve semantic cohesion at boundary splits.
* **Embeddings:** Vectorizes text chunks using Google's `gemini-embedding-2` model (producing `3072`-dimensional vector representations).
* **Limiter:** Includes a robust rate-limiter wrapper with exponential backoff to handle free-tier API quotas.

### 4. Grounding and Anti-Hallucination
* **Similarity Retrieval:** Queries the Chroma DB collection to fetch the top `15` most relevant page context chunks matching the user's question.
* **Prompt Hardening:** Passes the retrieved contexts and chat history to Gemini (`gemini-flash-latest`). The system prompt template enforces that the model answer **only** based on the provided context. If the answer is not present in the context, it must respond exactly: `"I couldn't find that information on the crawled website."` to prevent hallucination.
* **Sources Citations:** Collects metadata (titles and source URLs) from the retrieved vector document chunks and presents them as clickable source badges in the UI beneath the chatbot answer.

---

## Evaluation & Trade-offs

### What Works Well
* **Interactive Dark Dashboard:** Modern theme (`#0F0F0F` / `#1A1A1A` with `#7C3AED` Purple accents) featuring real-time scrolling logs, accordion page previews, typing indicators, and suggested prompts.
* **Robots.txt Integration:** High standard of crawling ethics by parsing and respecting target rules before execution.
* **Smart Backoff:** Resilient embedding pipeline that handles standard token limits and transient network timeouts gracefully.

### Limitations & Weaknesses
* **Scraper Blocking (Anti-Bot WAFs):** Raw Axios HTTP clients cannot bypass websites protected by Cloudflare or Akamai (e.g., Flipkart). It will return a `403 Forbidden` since it lacks TLS fingerprinting and JS execution.
* **Context Fragmentation:** Standard character-based chunking can break important tables or split nested context sentences across boundaries, weakening retrieval accuracy on long, complex documents.
* **Single Collection Limit:** The system currently wipes the vector store database collection on every new crawl, supporting only one crawled site at a time.
* **Local Database Dependency:** Requires the user to have Python and a local Chroma service running, adding Friction to the onboarding developer experience.

### Proposed Future Improvements
1. **Stealth Headless Scraping:** Replace Axios/Cheerio with a headless browser automation library like **Playwright** or **Puppeteer** (augmented with `puppeteer-extra-plugin-stealth`) to bypass advanced anti-bot challenges.
2. **Parent-Child Document Retrieval:** Implement parent-child chunking where the database indexes small child chunks for precise semantic matching, but retrieves and sends the larger parent document context to Gemini.
3. **Database Multi-Tenancy:** Partition isolated Chroma database collections per website hostname, allowing users to index and switch between multiple websites dynamically without wiping previous data.
4. **Dockerized Environment:** Package the Node backend, React frontend, and Chroma service inside a single `docker-compose.yml` to support one-command onboarding.
