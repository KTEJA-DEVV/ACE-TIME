// Load .env FIRST before any other imports
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';

import authRoutes from './routes/auth';
import roomRoutes from './routes/rooms';
import callRoutes from './routes/calls';
import userRoutes from './routes/users';
import messageRoutes from './routes/messages';
import imageRoutes from './routes/images';
import networkRoutes from './routes/network';
import { setupSocketHandlers } from './socket';
import { errorHandler, notFoundHandler, setupUnhandledRejectionHandler } from './middleware/errorHandler';
import { initGridFS } from './services/storage';
import { isOpenAIConfigured } from './services/openai';

// Setup global error handlers
setupUnhandledRejectionHandler();

// Debug: Log environment
console.log('📋 Environment loaded:');
console.log('   PORT:', process.env.PORT || '3001 (default)');
console.log('   MONGODB_URI:', process.env.MONGODB_URI ? '✓ Set' : '✗ Not set (using localhost)');
console.log('   OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '✓ Set (' + process.env.OPENAI_API_KEY.substring(0, 10) + '...)' : '✗ Not set');
console.log('   JWT_SECRET:', process.env.JWT_SECRET ? '✓ Set (' + process.env.JWT_SECRET.substring(0, 10) + '...)' : '✗ Not set (using default)');
console.log('   CLIENT_URL:', process.env.CLIENT_URL || 'Not set (using * - allowing all origins)');

const app = express();
const httpServer = createServer(app);

// CORS configuration - support multiple origins
const getCorsOrigin = (): string | string[] | boolean => {
  const clientUrl = process.env.CLIENT_URL;
  if (!clientUrl) {
    return '*'; // Allow all origins in development
  }
  
  // Support multiple origins separated by comma
  if (clientUrl.includes(',')) {
    return clientUrl.split(',').map(url => url.trim());
  }
  
  return clientUrl;
};

const corsOrigin = getCorsOrigin();
console.log('🌐 CORS origin:', Array.isArray(corsOrigin) ? corsOrigin.join(', ') : corsOrigin);

// Socket.IO setup
const io = new Server(httpServer, {
  cors: {
    origin: corsOrigin,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'], // Support both transports
  allowEIO3: true, // Allow Engine.IO v3 clients
});

console.log('📡 Socket.IO server configured');

// Middleware
app.use(cors({
  origin: corsOrigin,
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Root route - API info
app.get('/', (req, res) => {
  res.json({ 
    name: 'AceTime API',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      auth: '/api/auth',
      rooms: '/api/rooms',
      calls: '/api/calls',
      users: '/api/users',
      messages: '/api/messages',
      images: '/api/images',
      network: '/api/network',
    },
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    openai: isOpenAIConfigured() ? 'configured' : 'not configured (mock mode)',
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/calls', callRoutes);
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/images', imageRoutes);
app.use('/api/network', networkRoutes);

// 404 handler for unknown routes
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// Socket.IO handlers
setupSocketHandlers(io);

// Make io accessible to routes
app.set('io', io);

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://saitejat562:S%40i123tej@cluster0.vkyh8.mongodb.net/acetime';

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB');
    
    // Initialize GridFS for file storage
    initGridFS();
    
    const PORT = Number(process.env.PORT) || 3001;
    httpServer.listen(PORT, () => {
      console.log(`🚀 AceTime API running on port ${PORT}`);
      console.log(`📡 Socket.IO ready for connections`);
      console.log(`🌐 Server accessible at http://localhost:${PORT}`);
      
      if (!isOpenAIConfigured()) {
        console.log('⚠️  OpenAI not configured - transcription/AI notes will use mock data');
        console.log('   Add OPENAI_API_KEY to .env to enable AI features');
      } else {
        console.log('✅ OpenAI configured - AI features enabled');
      }
    });
  })
  .catch((error) => {
    console.error('❌ MongoDB connection error:', error);
    console.error('   Error details:', error.message);
    console.error('   Attempting to start server anyway (some features may not work)...');
    
    // Start server even if MongoDB fails (for development)
    const PORT = Number(process.env.PORT) || 3001;
    httpServer.listen(PORT, () => {
      console.log(`⚠️  AceTime API running on port ${PORT} (MongoDB not connected)`);
      console.log(`📡 Socket.IO ready for connections`);
      console.log(`🌐 Server accessible at http://localhost:${PORT}`);
      console.log('   Note: Database features will not work until MongoDB is connected');
    });
  });

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  await mongoose.connection.close();
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

export { io };
