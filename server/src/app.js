import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import crawlRoutes from './routes/crawl.routes.js';
import chatRoutes from './routes/chat.routes.js';
import 'dotenv/config';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Health route (keeps the client UI dashboard active)
app.get('/api/health', (req, res) => {
  res.json({ status: 'success', message: 'Server is running smoothly!' });
});

// Mounted routes
app.use('/api', crawlRoutes); // Handles POST /crawl and POST /index
app.use('/api', chatRoutes);  // Handles POST /chat

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export default app;
