require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
const { createServer } = require('http');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

// Initialize Express app
const app = express();
const server = createServer(app);

// Initialize WebSocket server
const wss = new WebSocket.Server({ 
  server,
  path: '/ws'
});

// Middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'", "ws:", "wss:"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

app.use(cors({
  origin: true, // Allow all origins for widget
  credentials: true
}));

app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Serve static files - IMPORTANT: Add these lines
app.use('/widget', express.static(path.join(__dirname, '../../src/client/widget')));
app.use('/widget', express.static(path.join(__dirname, '../../public/widget')));
app.use(express.static(path.join(__dirname, '../../public')));

// Store active WebSocket connections
const connections = new Map();

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    service: 'Neo Live Chat API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    connections: connections.size
  });
});

// API info endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'Neo LiveChat API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      chat: '/api/chat',
      websocket: 'ws://localhost:3000/ws'
    }
  });
});

// Chat endpoint (REST fallback)
app.post('/api/chat', async (req, res) => {
  try {
    const { message, sessionId, customerId } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    // For now, echo the message (we'll integrate AI later)
    const response = {
      id: uuidv4(),
      sessionId: sessionId || uuidv4(),
      customerId: customerId || 'anonymous',
      message: message,
      response: `Echo: ${message}`,
      timestamp: new Date().toISOString()
    };
    
    res.json(response);
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Widget configuration endpoint
app.get('/api/widget/config', (req, res) => {
  const { customerId } = req.query;
  
  res.json({
    customerId: customerId || 'demo',
    theme: {
      primaryColor: '#0066cc',
      position: 'bottom-right',
      greeting: 'Hi! How can I help you today?'
    },
    features: {
      fileUpload: false,
      emoji: true,
      typing: true,
      sound: true
    }
  });
});

// Temporary explicit route for test.html
app.get('/test.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/test.html'));
});

// Debug route - TEMPORARY
app.get('/debug', (req, res) => {
  const publicPath = path.join(__dirname, '../../public');
  res.json({
    __dirname: __dirname,
    publicPath: publicPath,
    exists: require('fs').existsSync(publicPath),
    testHtmlExists: require('fs').existsSync(path.join(publicPath, 'test.html'))
  });
});



// WebSocket connection handling
wss.on('connection', (ws, req) => {
  const connectionId = uuidv4();
  console.log(`New WebSocket connection: ${connectionId}`);
  
  // Store connection
  connections.set(connectionId, {
    ws,
    sessionId: null,
    customerId: null,
    connected: new Date()
  });
  
  // Send welcome message
  ws.send(JSON.stringify({
    type: 'connected',
    connectionId,
    timestamp: new Date().toISOString()
  }));
  
  // Handle incoming messages
  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.log(`Message from ${connectionId}:`, message);
      
      switch (message.type) {
        case 'init':
          // Initialize session
          connections.get(connectionId).sessionId = message.sessionId || uuidv4();
          connections.get(connectionId).customerId = message.customerId;
          
          ws.send(JSON.stringify({
            type: 'initialized',
            sessionId: connections.get(connectionId).sessionId,
            timestamp: new Date().toISOString()
          }));
          break;
          
        case 'message':
          // Handle chat message
          const responseMessage = {
            type: 'message',
            id: uuidv4(),
            message: `Echo: ${message.content}`,
            timestamp: new Date().toISOString()
          };
          
          // Simulate typing indicator
          ws.send(JSON.stringify({
            type: 'typing',
            isTyping: true
          }));
          
          // Simulate response delay
          setTimeout(() => {
            ws.send(JSON.stringify({
              type: 'typing',
              isTyping: false
            }));
            ws.send(JSON.stringify(responseMessage));
          }, 1000);
          break;
          
        case 'ping':
          ws.send(JSON.stringify({ type: 'pong' }));
          break;
          
        default:
          console.log('Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
      ws.send(JSON.stringify({
        type: 'error',
        error: 'Invalid message format'
      }));
    }
  });
  
  // Handle disconnection
  ws.on('close', () => {
    console.log(`WebSocket disconnected: ${connectionId}`);
    connections.delete(connectionId);
  });
  
  // Handle errors
  ws.on('error', (error) => {
    console.error(`WebSocket error for ${connectionId}:`, error);
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Global error:', err);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' 
      ? 'Something went wrong!' 
      : err.message
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`
🚀 Neo LiveChat API is running!
📍 HTTP: http://localhost:${PORT}
📍 WebSocket: ws://localhost:${PORT}/ws
📍 Health: http://localhost:${PORT}/health
📍 Test Page: http://localhost:${PORT}/test.html
🌍 Environment: ${process.env.NODE_ENV || 'development'}
  `);
});