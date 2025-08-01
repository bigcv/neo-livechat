const { Pool } = require('pg');

// Create PostgreSQL connection pool
const pool = new Pool({
  host: process.env.DB_HOST || 'postgres',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'chatplatform',
  user: process.env.DB_USER || 'chatapp',
  password: process.env.DB_PASSWORD || 'secretpassword123',
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test database connection
pool.on('connect', () => {
  console.log('📦 Database connected successfully');
});

pool.on('error', (err) => {
  console.error('❌ Unexpected database error:', err);
  process.exit(-1);
});

// Database functions
const db = {
  // Get or create a customer
  async getOrCreateCustomer(customerIdentifier) {
    // First try to find existing customer by email (using identifier as email prefix)
    const email = `${customerIdentifier}@example.com`;
    
    let customer = await pool.query(
      'SELECT * FROM customers WHERE email = $1',
      [email]
    );
    
    if (customer.rows.length > 0) {
      return customer.rows[0];
    }
    
    // Customer doesn't exist, create new one
    const query = `
      INSERT INTO customers (name, email, plan)
      VALUES ($1, $2, 'free')
      RETURNING *
    `;
    
    const values = [
      `Customer ${customerIdentifier}`,
      email
    ];
    
    try {
      const result = await pool.query(query, values);
      return result.rows[0];
    } catch (error) {
      console.error('Error creating customer:', error);
      throw error;
    }
  },

  // Create a new chat session
  async createChatSession(customerId, visitorId, visitorInfo = {}) {
    const query = `
      INSERT INTO chat_sessions (customer_id, visitor_id, visitor_name, visitor_email, visitor_metadata, status)
      VALUES ($1, $2, $3, $4, $5, 'active')
      RETURNING *
    `;
    
    const values = [
      customerId || 'demo',
      visitorId,
      visitorInfo.name || null,
      visitorInfo.email || null,
      JSON.stringify(visitorInfo.metadata || {})
    ];
    
    try {
      const result = await pool.query(query, values);
      return result.rows[0];
    } catch (error) {
      console.error('Error creating chat session:', error);
      throw error;
    }
  },

  // Get existing chat session
  async getChatSession(sessionId) {
    const query = `
      SELECT * FROM chat_sessions 
      WHERE id = $1
    `;
    
    try {
      const result = await pool.query(query, [sessionId]);
      return result.rows[0];
    } catch (error) {
      console.error('Error getting chat session:', error);
      throw error;
    }
  },

  // Get active sessions for a customer
  async getActiveSessions(customerId) {
    const query = `
      SELECT * FROM chat_sessions 
      WHERE customer_id = $1 AND status = 'active'
      ORDER BY started_at DESC
    `;
    
    try {
      const result = await pool.query(query, [customerId]);
      return result.rows;
    } catch (error) {
      console.error('Error getting active sessions:', error);
      throw error;
    }
  },

  // Save a message
  async saveMessage(sessionId, senderType, senderId, content, metadata = {}) {
    const query = `
      INSERT INTO messages (session_id, sender_type, sender_id, content, metadata)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    
    const values = [
      sessionId,
      senderType, // 'visitor', 'bot', 'agent'
      senderId || 'system',
      content,
      JSON.stringify(metadata)
    ];
    
    try {
      const result = await pool.query(query, values);
      return result.rows[0];
    } catch (error) {
      console.error('Error saving message:', error);
      throw error;
    }
  },

  // Get messages for a session
  async getSessionMessages(sessionId, limit = 50) {
    const query = `
      SELECT * FROM messages 
      WHERE session_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `;
    
    try {
      const result = await pool.query(query, [sessionId, limit]);
      return result.rows.reverse(); // Return in chronological order
    } catch (error) {
      console.error('Error getting messages:', error);
      throw error;
    }
  },

  // Update session status
  async updateSessionStatus(sessionId, status) {
    const query = `
      UPDATE chat_sessions 
      SET status = $2::varchar,
          ended_at = CASE WHEN $2::varchar = 'closed' THEN CURRENT_TIMESTAMP ELSE ended_at END
      WHERE id = $1
      RETURNING *
    `;
    
    try {
      const result = await pool.query(query, [sessionId, status]);
      return result.rows[0];
    } catch (error) {
      console.error('Error updating session status:', error);
      throw error;
    }
  },

  // Save analytics event
  async saveAnalyticsEvent(customerId, eventType, eventData = {}) {
    const query = `
      INSERT INTO analytics_events (customer_id, event_type, event_data)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    
    const values = [
      customerId,
      eventType,
      JSON.stringify(eventData)
    ];
    
    try {
      const result = await pool.query(query, values);
      return result.rows[0];
    } catch (error) {
      console.error('Error saving analytics event:', error);
      // Don't throw - analytics shouldn't break the app
      return null;
    }
  },

  // Get or create a session by visitor ID
  async getOrCreateSessionByVisitor(customerId, visitorId) {
    // Look for recent sessions (within last 24 hours)
    const findQuery = `
      SELECT * FROM chat_sessions 
      WHERE customer_id = $1 
        AND visitor_id = $2 
        AND (status = 'active' OR started_at > NOW() - INTERVAL '24 hours')
      ORDER BY started_at DESC
      LIMIT 1
    `;
    
    try {
      console.log('Looking for existing session:', { customerId, visitorId });
      const existing = await pool.query(findQuery, [customerId, visitorId]);
      
      if (existing.rows.length > 0) {
        console.log('Found existing session:', existing.rows[0].id);
        // Reactivate the session if it was closed
        if (existing.rows[0].status !== 'active') {
          const reactivated = await this.updateSessionStatus(existing.rows[0].id, 'active');
          return reactivated;
        }
        return existing.rows[0];
      }
      
      // No recent session, create a new one
      console.log('No recent session found, creating new one');
      return await this.createChatSession(customerId, visitorId);
    } catch (error) {
      console.error('Error getting/creating session:', error);
      throw error;
    }
  },

  // Health check
  async healthCheck() {
    try {
      const result = await pool.query('SELECT NOW()');
      return { healthy: true, timestamp: result.rows[0].now };
    } catch (error) {
      return { healthy: false, error: error.message };
    }
  }
};

module.exports = { db, pool };