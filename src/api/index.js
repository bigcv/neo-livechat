require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser'); // NEW: For handling cookies
const path = require('path');
const { createServer } = require('http');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const { db } = require('./db');
const aiService = require('./services/aiService');

// NEW: Import authentication routes and middleware
const authRoutes = require('./routes/auth');
const { authenticateApiKey } = require('./middleware/auth');

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
app.use(cookieParser()); // NEW: Parse cookies
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Serve static files
app.use('/widget', express.static(path.join(__dirname, '../../src/client/widget')));
app.use('/widget', express.static(path.join(__dirname, '../../public/widget')));
app.use(express.static(path.join(__dirname, '../../public')));

// Store active WebSocket connections
const connections = new Map();

// NEW: Authentication routes
app.use('/api/auth', authRoutes);

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
      auth: '/api/auth',
      chat: '/api/chat',
      websocket: 'ws://localhost:3000/ws'
    }
  });
});

// Chat endpoint (REST fallback) - NOW WITH API KEY AUTHENTICATION
app.post('/api/chat', authenticateApiKey, async (req, res) => {
  try {
    const { message, sessionId } = req.body;
    const customerId = req.customer.id; // From API key authentication
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    // Get or create session
    let session;
    if (sessionId) {
      session = await db.getChatSession(sessionId);
    }
    if (!session) {
      const visitorId = sessionId || uuidv4();
      session = await db.createChatSession(customerId, visitorId);
    }
    
    // Save user message
    await db.saveMessage(session.id, 'visitor', 'rest-api', message);
    
    // Get conversation history for context
    const history = await db.getSessionMessages(session.id, 10);
    
    // Generate AI response
    const aiResponse = await aiService.generateResponse(message, session.id, history);
    const responseText = aiResponse.response;
    
    // Save bot response
    await db.saveMessage(session.id, 'bot', 'ai-assistant', responseText, {
      intent: aiResponse.intent,
      confidence: aiResponse.confidence
    });
    
    res.json({
      id: uuidv4(),
      sessionId: session.id,
      customerId: customerId,
      message: message,
      response: responseText,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Widget configuration endpoint - NOW WITH API KEY AUTHENTICATION
app.get('/api/widget/config', authenticateApiKey, async (req, res) => {
  try {
    const customerId = req.customer.id;
    
    // Get customer's widget configuration from database
    const result = await db.pool.query(
      'SELECT * FROM widget_configs WHERE customer_id = $1',
      [customerId]
    );
    
    const config = result.rows[0] || {};
    
    res.json({
      customerId: customerId,
      theme: {
        primaryColor: config.theme?.primaryColor || '#0066cc',
        position: config.position || 'bottom-right',
        greeting: config.greeting_message || 'Hi! How can I help you today?'
      },
      features: {
        fileUpload: false,
        emoji: true,
        typing: true,
        sound: true
      }
    });
  } catch (error) {
    console.error('Widget config error:', error);
    // Fallback to default config if there's an error
    res.json({
      customerId: req.customer.id,
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
  }
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

// AI intents endpoint - shows available AI responses
app.get('/api/ai/intents', (req, res) => {
  const intents = Object.keys(aiService.intents).map(key => ({
    name: key,
    patterns: aiService.intents[key].patterns.length,
    responses: aiService.intents[key].responses.length
  }));
  
  res.json({
    intents,
    faqCount: aiService.faqs.length,
    smallTalkPatterns: aiService.smallTalk.patterns.length
  });
});

// Test AI response endpoint
app.post('/api/ai/test', async (req, res) => {
  try {
    const { message, sessionId = 'test-session' } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    const response = await aiService.generateResponse(message, sessionId);
    const sentiment = aiService.analyzeSentiment(message);
    const needsHuman = aiService.needsHumanAgent(message, sentiment);
    
    res.json({
      message,
      response: response.response,
      intent: response.intent,
      confidence: response.confidence,
      sentiment,
      needsHuman
    });
  } catch (error) {
    console.error('Error testing AI:', error);
    res.status(500).json({ error: 'Failed to generate response' });
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
            console.log('Init received with:', { customerId: message.customerId, sessionId: message.sessionId });
            
            // Get or create customer
            const customer = await db.getOrCreateCustomer(message.customerId);
            console.log('Customer:', customer.id);
            
            // Get or create session
            const visitorId = message.sessionId || uuidv4();
            const session = await db.getOrCreateSessionByVisitor(customer.id, visitorId);
            console.log('Session found/created:', session.id, 'Status:', session.status);
            
            // Update connection info
            connection.sessionId = session.id;
            connection.customerId = customer.id;
            connection.dbSession = session;
            
            // Save analytics event
            await db.saveAnalyticsEvent(customer.id, 'chat_started', {
              sessionId: session.id,
              visitorId: visitorId
            });
            
            // Get session history
            const history = await db.getSessionMessages(session.id);
            console.log('Loading history:', history.length, 'messages');
            
            // Send initialization confirmation with session history
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
            
            // Get conversation history for context
            const history = await db.getSessionMessages(connection.sessionId, 10);
            
            // Generate AI response
            const aiResponse = await aiService.generateResponse(
              message.content, 
              connection.sessionId, 
              history
            );
            
            // Check if human agent is needed
            const sentiment = aiService.analyzeSentiment(message.content);
            const needsHuman = aiService.needsHumanAgent(message.content, sentiment);
            
            if (needsHuman) {
              // Send notification that human is needed
              ws.send(JSON.stringify({
                type: 'notification',
                message: '🤝 I\'ll connect you with a human agent right away. They\'ll be with you shortly!',
                needsAgent: true
              }));
            }
            
            // Send typing indicator
            ws.send(JSON.stringify({
              type: 'typing',
              isTyping: true
            }));
            
            // Simulate response delay based on message length
            const typingDelay = Math.min(Math.max(aiResponse.response.length * 20, 500), 2000);
            
            setTimeout(async () => {
              try {
                // Save bot response to database
                const botMessage = await db.saveMessage(
                  connection.sessionId,
                  'bot',
                  'ai-assistant',
                  aiResponse.response,
                  {
                    intent: aiResponse.intent,
                    confidence: aiResponse.confidence,
                    sentiment: sentiment,
                    needsHuman: needsHuman
                  }
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
                  message: aiResponse.response,
                  timestamp: botMessage.created_at,
                  metadata: {
                    intent: aiResponse.intent,
                    confidence: aiResponse.confidence
                  }
                }));
                
                // Save analytics
                await db.saveAnalyticsEvent(connection.customerId, 'ai_response', {
                  sessionId: connection.sessionId,
                  intent: aiResponse.intent,
                  confidence: aiResponse.confidence,
                  sentiment: sentiment,
                  needsHuman: needsHuman
                });
              } catch (error) {
                console.error('Error sending bot response:', error);
              }
            }, typingDelay);
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
📍 Auth: http://localhost:${PORT}/api/auth
📍 Test Page: http://localhost:${PORT}/test.html
🌍 Environment: ${process.env.NODE_ENV || 'development'}
  `);
});