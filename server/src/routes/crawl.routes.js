import { Router } from 'express';
import { crawlWebsite, indexContent } from '../controllers/crawl.controller.js';

const router = Router();

// Endpoint: POST /api/crawl
// Purpose: Trigger crawling on a website URL
router.post('/crawl', crawlWebsite);

// Endpoint: POST /api/index
// Purpose: Store crawled website page data into the Chroma vector database
router.post('/index', indexContent);

export default router;
