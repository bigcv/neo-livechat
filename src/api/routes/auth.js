// src/api/routes/auth.js
const express = require('express');
const Joi = require('joi');
const authService = require('../services/authService');
const { authenticateCustomer, validateInput } = require('../middleware/auth');

const router = express.Router();

// Validation schemas
const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  name: Joi.string().min(2).max(100).required(),
  companyName: Joi.string().max(255).optional(),
  websiteUrl: Joi.string().uri().optional(),
  phone: Joi.string().max(50).optional()
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

// Register new customer
router.post('/register', validateInput(registerSchema), async (req, res) => {
  try {
    const result = await authService.register(req.body);
    
    res.status(201).json({
      success: true,
      message: 'Account created successfully! Please check your email to verify your account.',
      customer: result.customer
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(400).json({ 
      error: error.message || 'Registration failed' 
    });
  }
});

// Login
router.post('/login', validateInput(loginSchema), async (req, res) => {
  try {
    const { email, password } = req.body;
    const ipAddress = req.ip;
    const userAgent = req.get('User-Agent');
    
    const result = await authService.login(email, password, ipAddress, userAgent);
    
    // Set session cookie (httpOnly for security)
    res.cookie('sessionToken', result.sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: result.expiresAt
    });
    
    res.json({
      success: true,
      message: 'Login successful',
      customer: result.customer,
      sessionToken: result.sessionToken, // Also return in body for API clients
      expiresAt: result.expiresAt
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(401).json({ 
      error: error.message || 'Login failed' 
    });
  }
});

// Get current customer profile
router.get('/me', authenticateCustomer, async (req, res) => {
  try {
    const dashboardData = await authService.getDashboardData(req.customer.id);
    
    res.json({
      success: true,
      customer: {
        id: dashboardData.id,
        email: dashboardData.email,
        name: dashboardData.name,
        companyName: dashboardData.company_name,
        plan: dashboardData.plan,
        subscriptionStatus: dashboardData.subscription_status,
        trialEndsAt: dashboardData.trial_ends_at,
        createdAt: dashboardData.created_at,
        lastLogin: dashboardData.last_login
      },
      stats: {
        chatsLast30Days: dashboardData.chats_last_30_days,
        chatsLast7Days: dashboardData.chats_last_7_days,
        activeChats: dashboardData.active_chats,
        activeApiKeys: dashboardData.active_api_keys
      },
      widget: {
        name: dashboardData.widget_name,
        active: dashboardData.widget_active,
        position: dashboardData.position,
        greeting: dashboardData.greeting_message,
        theme: dashboardData.theme
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ 
      error: 'Failed to load profile' 
    });
  }
});

// Generate new API key
router.post('/api-keys', authenticateCustomer, async (req, res) => {
  try {
    const { name } = req.body;
    const keyName = name || `API Key ${new Date().toLocaleDateString()}`;
    
    const apiKey = await authService.generateApiKey(req.customer.id, keyName);
    
    res.status(201).json({
      success: true,
      message: 'API key generated successfully',
      apiKey: {
        id: apiKey.id,
        name: apiKey.key_name,
        key: apiKey.api_key,
        createdAt: apiKey.created_at
      }
    });
  } catch (error) {
    console.error('Generate API key error:', error);
    res.status(500).json({ 
      error: 'Failed to generate API key' 
    });
  }
});

module.exports = router;
