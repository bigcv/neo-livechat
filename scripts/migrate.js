// scripts/migrate.js - Database migration runner
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'postgres',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'chatplatform',
  user: process.env.DB_USER || 'chatapp',
  password: process.env.DB_PASSWORD || 'secretpassword123',
});

async function runMigration() {
  try {
    console.log('🚀 Starting database migration...');
    
    // Create migrations table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Check if this migration has already been run
    const migrationCheck = await pool.query(
      'SELECT * FROM migrations WHERE filename = $1',
      ['002_customer_auth.sql']
    );
    
    if (migrationCheck.rows.length > 0) {
      console.log('✅ Migration 002_customer_auth.sql already executed');
      return;
    }
    
    // Execute migration in a transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      console.log('📝 Adding authentication fields to customers table...');
      await client.query(`
        ALTER TABLE customers 
        ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255),
        ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS verification_token VARCHAR(255),
        ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255),
        ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS last_login TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS company_name VARCHAR(255),
        ADD COLUMN IF NOT EXISTS website_url VARCHAR(500),
        ADD COLUMN IF NOT EXISTS phone VARCHAR(50),
        ADD COLUMN IF NOT EXISTS timezone VARCHAR(100) DEFAULT 'UTC',
        ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50) DEFAULT 'trial',
        ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '14 days')
      `);
      
      console.log('📝 Creating customer sessions table...');
      await client.query(`
        CREATE TABLE IF NOT EXISTS customer_sessions (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
            session_token VARCHAR(255) UNIQUE NOT NULL,
            expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
            ip_address INET,
            user_agent TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      console.log('📝 Creating customer API keys table...');
      await client.query(`
        CREATE TABLE IF NOT EXISTS customer_api_keys (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
            key_name VARCHAR(100) NOT NULL,
            api_key VARCHAR(255) UNIQUE NOT NULL,
            is_active BOOLEAN DEFAULT true,
            last_used TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMP WITH TIME ZONE
        )
      `);
      
      console.log('📝 Updating widget configurations...');
      await client.query(`
        ALTER TABLE widget_configs 
        ADD COLUMN IF NOT EXISTS widget_name VARCHAR(100) DEFAULT 'Default Widget',
        ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
        ADD COLUMN IF NOT EXISTS allowed_domains TEXT[],
        ADD COLUMN IF NOT EXISTS business_hours JSONB DEFAULT '{"enabled": false, "timezone": "UTC", "schedule": {}}',
        ADD COLUMN IF NOT EXISTS auto_responses JSONB DEFAULT '{}',
        ADD COLUMN IF NOT EXISTS branding JSONB DEFAULT '{"showPoweredBy": true, "customLogo": null}'
      `);
      
      console.log('📝 Creating indexes...');
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_customer_sessions_token ON customer_sessions(session_token);
        CREATE INDEX IF NOT EXISTS idx_customer_sessions_customer_id ON customer_sessions(customer_id);
        CREATE INDEX IF NOT EXISTS idx_customer_api_keys_key ON customer_api_keys(api_key);
        CREATE INDEX IF NOT EXISTS idx_customer_api_keys_customer_id ON customer_api_keys(customer_id);
        CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
      `);
      
      console.log('📝 Creating helper functions...');
      await client.query(`
        CREATE OR REPLACE FUNCTION clean_expired_sessions()
        RETURNS void AS $$
        BEGIN
            DELETE FROM customer_sessions WHERE expires_at < CURRENT_TIMESTAMP;
        END;
        $$ LANGUAGE plpgsql;
      `);
      
      console.log('📝 Creating dashboard view...');
      await client.query(`
        CREATE OR REPLACE VIEW customer_dashboard_view AS
        SELECT 
            c.id,
            c.name,
            c.email,
            c.company_name,
            c.plan,
            c.subscription_status,
            c.trial_ends_at,
            c.created_at,
            c.last_login,
            
            -- Widget configuration
            wc.widget_name,
            wc.is_active as widget_active,
            wc.position,
            wc.greeting_message,
            wc.theme,
            
            -- Recent activity stats
            (SELECT COUNT(*) FROM chat_sessions cs WHERE cs.customer_id = c.id AND cs.started_at > CURRENT_TIMESTAMP - INTERVAL '30 days') as chats_last_30_days,
            (SELECT COUNT(*) FROM chat_sessions cs WHERE cs.customer_id = c.id AND cs.started_at > CURRENT_TIMESTAMP - INTERVAL '7 days') as chats_last_7_days,
            (SELECT COUNT(*) FROM chat_sessions cs WHERE cs.customer_id = c.id AND cs.status = 'active') as active_chats,
            
            -- API key info
            (SELECT COUNT(*) FROM customer_api_keys cak WHERE cak.customer_id = c.id AND cak.is_active = true) as active_api_keys

        FROM customers c
        LEFT JOIN widget_configs wc ON wc.customer_id = c.id;
      `);
      
      console.log('📝 Setting up default configurations...');
      await client.query(`
        INSERT INTO widget_configs (customer_id, widget_name, greeting_message)
        SELECT 
            c.id,
            'Default Widget',
            'Hi! How can I help you today?'
        FROM customers c
        WHERE NOT EXISTS (
            SELECT 1 FROM widget_configs wc WHERE wc.customer_id = c.id
        );
      `);
      
      console.log('📝 Updating demo customer...');
      await client.query(`
        UPDATE customers 
        SET 
            password_hash = '$2b$10$YourHashedPasswordHere',
            email_verified = true,
            company_name = 'Demo Company',
            website_url = 'https://demo.example.com',
            subscription_status = 'active'
        WHERE email = 'demo@example.com';
      `);
      
      console.log('📝 Creating demo API key...');
      await client.query(`
        INSERT INTO customer_api_keys (customer_id, key_name, api_key)
        SELECT 
            c.id,
            'Demo API Key',
            'demo_' || substr(md5(random()::text), 1, 32)
        FROM customers c
        WHERE c.email = 'demo@example.com'
        AND NOT EXISTS (
            SELECT 1 FROM customer_api_keys cak WHERE cak.customer_id = c.id
        );
      `);
      
      // Record migration as completed
      await client.query(
        'INSERT INTO migrations (filename) VALUES ($1)',
        ['002_customer_auth.sql']
      );
      
      await client.query('COMMIT');
      console.log('✅ Migration 002_customer_auth.sql executed successfully');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run migration if called directly
if (require.main === module) {
  runMigration();
}

module.exports = { runMigration };
