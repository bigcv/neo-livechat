require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
const { createServer } = require('http');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const { db } = require('./db');

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
app.get('/health', async (req, res) => {
  const dbHealth = await db.healthCheck();
  
  res.json({ 
    status: 'healthy',
    service: 'Neo Live Chat API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    connections: connections.size,
    database: dbHealth
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
    
    // Get or create customer
    const customer = await db.getOrCreateCustomer(customerId);
    
    // Get or create session
    let session;
    if (sessionId) {
      session = await db.getChatSession(sessionId);
    }
    if (!session) {
      const visitorId = sessionId || uuidv4();
      session = await db.createChatSession(customer.id, visitorId);
    }
    
    // Save user message
    await db.saveMessage(session.id, 'visitor', 'rest-api', message);
    
    // Generate response (echo for now)
    const responseText = `Echo: ${message}`;
    
    // Save bot response
    await db.saveMessage(session.id, 'bot', 'echo-bot', responseText);
    
    res.json({
      id: uuidv4(),
      sessionId: session.id,
      customerId: customer.id,
      message: message,
      response: responseText,
      timestamp: new Date().toISOString()
    });
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

// Get chat history
app.get('/api/sessions/:sessionId/messages', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const messages = await db.getSessionMessages(sessionId);
    
    res.json({
      sessionId,
      messages: messages.map(msg => ({
        id: msg.id,
        content: msg.content,
        senderType: msg.sender_type,
        senderId: msg.sender_id,
        timestamp: msg.created_at
      }))
    });
  } catch (error) {
    console.error('Error getting messages:', error);
    res.status(500).json({ error: 'Failed to retrieve messages' });
  }
});

// Get active sessions for a customer
app.get('/api/customers/:customerId/sessions', async (req, res) => {
  try {
    const { customerId } = req.params;
    const sessions = await db.getActiveSessions(customerId);
    
    res.json({
      customerId,
      sessions: sessions.map(session => ({
        id: session.id,
        visitorId: session.visitor_id,
        status: session.status,
        startedAt: session.started_at,
        lastActivity: session.updated_at
      }))
    });
  } catch (error) {
    console.error('Error getting sessions:', error);
    res.status(500).json({ error: 'Failed to retrieve sessions' });
  }
});

// WebSocket connection handling
wss.on('connection', (ws, req) => {
  const connectionId = uuidv4();
  console.log(`New WebSocket connection: ${connectionId}`);
  
  // Store connection with additional database info
  connections.set(connectionId, {
    ws,
    sessionId: null,
    customerId: null,
    dbSession: null,
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
      
      const connection = connections.get(connectionId);
      
      switch (message.type) {
        case 'init':
          try {
            // Get or create customer
            const customer = await db.getOrCreateCustomer(message.customerId);
            
            // Get or create session
            const visitorId = message.sessionId || uuidv4();
            const session = await db.getOrCreateSessionByVisitor(customer.id, visitorId);
            
            // Update connection info
            connection.sessionId = session.id;
            connection.customerId = customer.id;
            connection.dbSession = session;
            
            // Save analytics event
            await db.saveAnalyticsEvent(customer.id, 'chat_started', {
              sessionId: session.id,
              visitorId: visitorId
            });
            
            // Send initialization confirmation with session history
            const history = await db.getSessionMessages(session.id);
            
            ws.send(JSON.stringify({
              type: 'initialized',
              sessionId: session.id,
              history: history.map(msg => ({
                id: msg.id,
                content: msg.content,
                senderType: msg.sender_type,
                timestamp: msg.created_at
              })),
              timestamp: new Date().toISOString()
            }));
          } catch (error) {
            console.error('Error initializing session:', error);
            ws.send(JSON.stringify({
              type: 'error',
              error: 'Failed to initialize session'
            }));
          }
          break;
          
        case 'message':
          try {
            if (!connection.dbSession) {
              throw new Error('Session not initialized');
            }
            
            // Save user message to database
            const userMessage = await db.saveMessage(
              connection.sessionId,
              'visitor',
              connection.dbSession.visitor_id,
              message.content
            );
            
            // Generate response (echo for now)
            const responseText = `Echo: ${message.content}`;
            
            // Send typing indicator
            ws.send(JSON.stringify({
              type: 'typing',
              isTyping: true
            }));
            
            // Simulate response delay
            setTimeout(async () => {
              try {
                // Save bot response to database
                const botMessage = await db.saveMessage(
                  connection.sessionId,
                  'bot',
                  'echo-bot',
                  responseText
                );
                
                // Send typing indicator off
                ws.send(JSON.stringify({
                  type: 'typing',
                  isTyping: false
                }));
                
                // Send response
                ws.send(JSON.stringify({
                  type: 'message',
                  id: botMessage.id,
                  message: responseText,
                  timestamp: botMessage.created_at
                }));
                
                // Save analytics
                await db.saveAnalyticsEvent(connection.customerId, 'message_sent', {
                  sessionId: connection.sessionId,
                  messageCount: 1
                });
              } catch (error) {
                console.error('Error sending bot response:', error);
              }
            }, 1000);
          } catch (error) {
            console.error('Error handling message:', error);
            ws.send(JSON.stringify({
              type: 'error',
              error: 'Failed to process message'
            }));
          }
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
  ws.on('close', async () => {
    console.log(`WebSocket disconnected: ${connectionId}`);
    const connection = connections.get(connectionId);
    
    // Don't close the session immediately - user might just be refreshing
    // Only save analytics for the disconnect
    if (connection && connection.sessionId && connection.dbSession) {
      try {
        await db.saveAnalyticsEvent(connection.customerId, 'chat_paused', {
          sessionId: connection.sessionId,
          duration: Date.now() - connection.connected.getTime()
        });
      } catch (error) {
        console.error('Error saving disconnect event:', error);
      }
    }
    
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