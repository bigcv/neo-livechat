const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { createServer } = require('http');
const WebSocket = require('ws');

const app = express();
const server = createServer(app);
const wss = new WebSocket.Server({ server });

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    service: 'Neo Live Chat API',
    timestamp: new Date().toISOString()
  });
});

// Basic chat endpoint (we'll expand this)
app.post('/api/chat', async (req, res) => {
  const { message, sessionId } = req.body;
  
  // For now, echo back (we'll add AI later)
  res.json({
    response: `Echo: ${message}`,
    sessionId: sessionId || 'demo-session',
    timestamp: new Date().toISOString()
  });
});

// WebSocket connection for real-time chat
wss.on('connection', (ws) => {
  console.log('New WebSocket connection');
  
  ws.on('message', (message) => {
    console.log('Received:', message.toString());
    
    // Echo the message back (we'll add AI processing later)
    ws.send(JSON.stringify({
      type: 'response',
      message: `Echo: ${message}`,
      timestamp: new Date().toISOString()
    }));
  });
  
  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Neo LiveChat running on port ${PORT}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
});