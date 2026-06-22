import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import crawlRoutes from './routes/crawl.routes.js';
import chatRoutes from './routes/chat.routes.js';
import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(morgan('dev'));

// Health route (keeps the client UI dashboard active)
app.get('/api/health', (req, res) => {
  res.json({ status: 'success', message: 'Server is running smoothly!' });
});

// Mounted routes
app.use('/api', crawlRoutes); // Handles POST /crawl and POST /index
app.use('/api', chatRoutes);  // Handles POST /chat

// Serve frontend static files if client/dist exists
const clientDistPath = path.join(__dirname, '../../client/dist');
if (fs.existsSync(clientDistPath)) {
  console.log(`[Production] Serving static files from: ${clientDistPath}`);
  app.use(express.static(clientDistPath));
  
  // For single-page app (SPA) routing fallback
  app.get('*all', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
} else {
  console.log('[Development/API-only] Static client/dist not found. Serving API routes only.');
}

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export default app;
