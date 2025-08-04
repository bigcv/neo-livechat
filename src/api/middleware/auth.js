// src/api/middleware/auth.js
const authService = require('../services/authService');

// Middleware to authenticate customers via session token
const authenticateCustomer = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '') || 
                  req.cookies?.sessionToken ||
                  req.headers['x-session-token'];
    
    if (!token) {
      return res.status(401).json({ error: 'No authentication token provided' });
    }
    
    const session = await authService.validateSession(token);
    req.customer = session.customer;
    req.sessionId = session.sessionId;
    
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
};

// Middleware to authenticate via API key (for widget and API calls)
const authenticateApiKey = async (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'] || 
                   req.query.apiKey ||
                   req.body.apiKey;
    
    if (!apiKey) {
      return res.status(401).json({ error: 'API key required' });
    }
    
    const keyData = await authService.validateApiKey(apiKey);
    req.customer = {
      id: keyData.customerId,
      email: keyData.customerEmail,
      name: keyData.customerName
    };
    req.apiKeyName = keyData.keyName;
    
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
};

// Input validation middleware
const validateInput = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({ 
        error: 'Validation error',
        details: error.details.map(d => d.message)
      });
    }
    next();
  };
};

module.exports = {
  authenticateCustomer,
  authenticateApiKey,
  validateInput
};
