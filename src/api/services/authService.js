// src/api/services/authService.js
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../db');

class AuthService {
  constructor() {
    this.saltRounds = 12;
    this.jwtSecret = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';
    this.sessionExpireHours = 24 * 7; // 7 days
  }

  // Register new customer
  async register(customerData) {
    const { email, password, name, companyName, websiteUrl, phone } = customerData;
    
    try {
      // Check if customer already exists
      const existingCustomer = await pool.query(
        'SELECT id FROM customers WHERE email = $1',
        [email.toLowerCase()]
      );
      
      if (existingCustomer.rows.length > 0) {
        throw new Error('Customer with this email already exists');
      }
      
      // Hash password
      const passwordHash = await bcrypt.hash(password, this.saltRounds);
      
      // Generate verification token
      const verificationToken = uuidv4();
      
      // Create customer
      const customerQuery = `
        INSERT INTO customers (
          email, password_hash, name, company_name, website_url, phone,
          verification_token, plan, subscription_status, trial_ends_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'free', 'trial', $8)
        RETURNING id, email, name, company_name, created_at, trial_ends_at
      `;
      
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 14); // 14-day trial
      
      const result = await pool.query(customerQuery, [
        email.toLowerCase(),
        passwordHash,
        name,
        companyName || null,
        websiteUrl || null,
        phone || null,
        verificationToken,
        trialEndsAt
      ]);
      
      const customer = result.rows[0];
      
      // Create default widget configuration
      await this.createDefaultWidgetConfig(customer.id);
      
      // Generate API key
      await this.generateApiKey(customer.id, 'Default API Key');
      
      // TODO: Send verification email
      console.log(`Verification token for ${email}: ${verificationToken}`);
      
      return {
        customer: {
          id: customer.id,
          email: customer.email,
          name: customer.name,
          companyName: customer.company_name,
          createdAt: customer.created_at,
          trialEndsAt: customer.trial_ends_at
        },
        verificationToken // In production, don't return this
      };
      
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  }

  // Login customer
  async login(email, password, ipAddress, userAgent) {
    try {
      // Get customer with password hash
      const customerQuery = `
        SELECT id, email, password_hash, name, company_name, email_verified, is_active
        FROM customers 
        WHERE email = $1
      `;
      
      const result = await pool.query(customerQuery, [email.toLowerCase()]);
      
      if (result.rows.length === 0) {
        throw new Error('Invalid email or password');
      }
      
      const customer = result.rows[0];
      
      if (!customer.is_active) {
        throw new Error('Account is deactivated');
      }
      
      // Verify password
      const passwordValid = await bcrypt.compare(password, customer.password_hash);
      if (!passwordValid) {
        throw new Error('Invalid email or password');
      }
      
      // Update last login
      await pool.query(
        'UPDATE customers SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
        [customer.id]
      );
      
      // Create session
      const session = await this.createSession(customer.id, ipAddress, userAgent);
      
      return {
        customer: {
          id: customer.id,
          email: customer.email,
          name: customer.name,
          companyName: customer.company_name,
          emailVerified: customer.email_verified
        },
        sessionToken: session.sessionToken,
        expiresAt: session.expiresAt
      };
      
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  // Create session
  async createSession(customerId, ipAddress, userAgent) {
    try {
      const sessionToken = jwt.sign(
        { customerId, sessionId: uuidv4() },
        this.jwtSecret,
        { expiresIn: `${this.sessionExpireHours}h` }
      );
      
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + this.sessionExpireHours);
      
      // Truncate user agent to avoid database length limits
      const truncatedUserAgent = userAgent ? userAgent.substring(0, 500) : null;
      
      await pool.query(
        `INSERT INTO customer_sessions (customer_id, session_token, expires_at, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5)`,
        [customerId, sessionToken, expiresAt, ipAddress, truncatedUserAgent]
      );
      
      return { sessionToken, expiresAt };
    } catch (error) {
      console.error('Session creation error:', error);
      throw error;
    }
  }

  // Validate session token
  async validateSession(sessionToken) {
    try {
      // Decode JWT
      const decoded = jwt.verify(sessionToken, this.jwtSecret);
      
      // Check if session exists in database and is not expired
      const sessionQuery = `
        SELECT cs.*, c.id, c.email, c.name, c.company_name, c.is_active
        FROM customer_sessions cs
        JOIN customers c ON cs.customer_id = c.id
        WHERE cs.session_token = $1 AND cs.expires_at > CURRENT_TIMESTAMP
      `;
      
      const result = await pool.query(sessionQuery, [sessionToken]);
      
      if (result.rows.length === 0) {
        throw new Error('Invalid or expired session');
      }
      
      const session = result.rows[0];
      
      if (!session.is_active) {
        throw new Error('Account is deactivated');
      }
      
      return {
        customer: {
          id: session.id,
          email: session.email,
          name: session.name,
          companyName: session.company_name
        },
        sessionId: session.id
      };
      
    } catch (error) {
      if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
        throw new Error('Invalid or expired session');
      }
      throw error;
    }
  }

  // Logout (invalidate session)
  async logout(sessionToken) {
    try {
      await pool.query(
        'DELETE FROM customer_sessions WHERE session_token = $1',
        [sessionToken]
      );
      return true;
    } catch (error) {
      console.error('Logout error:', error);
      return false;
    }
  }

  // Generate API key for customer
  async generateApiKey(customerId, keyName = 'API Key') {
    try {
      const apiKey = 'neolivechat_' + uuidv4().replace(/-/g, '');
      
      const result = await pool.query(
        `INSERT INTO customer_api_keys (customer_id, key_name, api_key)
         VALUES ($1, $2, $3)
         RETURNING id, key_name, api_key, created_at`,
        [customerId, keyName, apiKey]
      );
      
      return result.rows[0];
    } catch (error) {
      console.error('API key generation error:', error);
      throw error;
    }
  }

  // Get customer API keys
  async getApiKeys(customerId) {
    try {
      const result = await pool.query(
        `SELECT id, key_name, api_key, is_active, last_used, created_at
         FROM customer_api_keys 
         WHERE customer_id = $1 
         ORDER BY created_at DESC`,
        [customerId]
      );
      
      return result.rows;
    } catch (error) {
      console.error('Get API keys error:', error);
      throw error;
    }
  }

  // Validate API key
  async validateApiKey(apiKey) {
    try {
      const result = await pool.query(
        `SELECT cak.*, c.id as customer_id, c.email, c.name, c.is_active as customer_active
         FROM customer_api_keys cak
         JOIN customers c ON cak.customer_id = c.id
         WHERE cak.api_key = $1 AND cak.is_active = true
         AND (cak.expires_at IS NULL OR cak.expires_at > CURRENT_TIMESTAMP)`,
        [apiKey]
      );
      
      if (result.rows.length === 0) {
        throw new Error('Invalid API key');
      }
      
      const keyData = result.rows[0];
      
      if (!keyData.customer_active) {
        throw new Error('Customer account is deactivated');
      }
      
      // Update last used timestamp
      await pool.query(
        'UPDATE customer_api_keys SET last_used = CURRENT_TIMESTAMP WHERE id = $1',
        [keyData.id]
      );
      
      return {
        customerId: keyData.customer_id,
        customerEmail: keyData.email,
        customerName: keyData.name,
        keyName: keyData.key_name
      };
      
    } catch (error) {
      console.error('API key validation error:', error);
      throw error;
    }
  }

  // Create default widget configuration
  async createDefaultWidgetConfig(customerId) {
    try {
      const result = await pool.query(
        `INSERT INTO widget_configs (customer_id, widget_name, greeting_message, theme)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [
          customerId,
          'Default Widget',
          'Hi! How can I help you today?',
          JSON.stringify({
            primaryColor: '#0066cc',
            fontFamily: 'system',
            borderRadius: '12px'
          })
        ]
      );
      
      return result.rows[0];
    } catch (error) {
      console.error('Default widget config creation error:', error);
      throw error;
    }
  }

  // Get customer dashboard data
  async getDashboardData(customerId) {
    try {
      const result = await pool.query(
        'SELECT * FROM customer_dashboard_view WHERE id = $1',
        [customerId]
      );
      
      if (result.rows.length === 0) {
        throw new Error('Customer not found');
      }
      
      return result.rows[0];
    } catch (error) {
      console.error('Dashboard data error:', error);
      throw error;
    }
  }

  // Clean expired sessions (run periodically)
  async cleanExpiredSessions() {
    try {
      await pool.query('SELECT clean_expired_sessions()');
      console.log('Cleaned expired sessions');
    } catch (error) {
      console.error('Clean sessions error:', error);
    }
  }

  // Change password
  async changePassword(customerId, currentPassword, newPassword) {
    try {
      // Get current password hash
      const result = await pool.query(
        'SELECT password_hash FROM customers WHERE id = $1',
        [customerId]
      );
      
      if (result.rows.length === 0) {
        throw new Error('Customer not found');
      }
      
      // Verify current password
      const passwordValid = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
      if (!passwordValid) {
        throw new Error('Current password is incorrect');
      }
      
      // Hash new password
      const newPasswordHash = await bcrypt.hash(newPassword, this.saltRounds);
      
      // Update password
      await pool.query(
        'UPDATE customers SET password_hash = $1 WHERE id = $2',
        [newPasswordHash, customerId]
      );
      
      return true;
    } catch (error) {
      console.error('Change password error:', error);
      throw error;
    }
  }
}

module.exports = new AuthService();