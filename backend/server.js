const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

// Import cron service for scheduled tasks
const cronService = require('./services/cronService');

const app = express();
const PORT = process.env.PORT || 3001;

app.set('trust proxy', 1);

// Security middleware - disable CSP temporarily to test Stripe integration
app.use(helmet({
  contentSecurityPolicy: false
}));
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    'https://staylabel.fly.dev', 
  ],
  credentials: true
}));

// Rate limiting (more lenient for development)
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  limit: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
  message: 'Too many requests from this IP, please try again later.'
});

app.use('/api/', limiter);

// Stripe webhook needs raw body for signature verification
app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }));

// Body parsing middleware for other routes
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString(), service: 'Staylabel API' });
});

// Import routes
const webhookRoutes = require('./routes/webhooks');
const reservationRoutes = require('./routes/reservationRoutes');
const checkinRoutes = require('./routes/checkin');
const adminCheckinRoutes = require('./routes/checkinRoutes');
const authRoutes = require('./routes/authRoutes');
const propertyRoutes = require('./routes/propertyRoutes');
const roomRoutes = require('./routes/roomRoutes');
const userRoutes = require('./routes/userRoutes');
const cleaningRoutes = require('./routes/cleaningRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const guestRoutes = require('./routes/guest');
const communicationRoutes = require('./routes/communicationRoutes');
const automationRoutes = require('./routes/automationRoutes');
const pricingRoutes = require('./routes/pricingRoutes');
const roomTypeRoutes = require('./routes/roomTypeRoutes');
const marketDemandRoutes = require('./routes/marketDemandRoutes');
const calendarRoutes = require('./routes/calendarRoutes');
const upsellRoutes = require('./routes/upsellRoutes');
const translationRoutes = require('./routes/translationRoutes');

// Debug middleware to log all API requests
app.use('/api/*', (req, res, next) => {
  next();
});

// API routes
app.use('/api/webhooks', webhookRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/checkin', checkinRoutes);
app.use('/api/checkins', adminCheckinRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api', roomRoutes);
app.use('/api/users', userRoutes);
app.use('/api/cleaning', cleaningRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/guest', guestRoutes);
app.use('/api/communication', communicationRoutes);
app.use('/api/automation', automationRoutes);
app.use('/api/pricing', pricingRoutes);
app.use('/api/room-types', roomTypeRoutes);
app.use('/api/market-demand', marketDemandRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/upsell', upsellRoutes);
app.use('/api/translations', translationRoutes);

// Serve static files from frontend build
// In development: frontend is at ../frontend/dist
// In production (Docker): frontend is at ./frontend/dist
const frontendPath = process.env.NODE_ENV === 'production' 
  ? path.resolve(__dirname, 'frontend', 'dist')
  : path.resolve(__dirname, '../frontend', 'dist');
console.log('Serving SPA from:', frontendPath);

app.use(express.static(frontendPath, {
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : '0',
  etag: true,
  lastModified: true,
  // Set correct MIME types
  setHeaders: (res, path) => {
    if (path.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    } else if (path.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css; charset=utf-8');
    }
  }
}));

// SPA fallback - serve index.html for all non-API routes that don't match static assets
app.get('*', (req, res, next) => {
  // Don't serve index.html for asset requests
  if (req.path.startsWith('/assets/') || 
      req.path.endsWith('.js') || 
      req.path.endsWith('.css') || 
      req.path.endsWith('.png') || 
      req.path.endsWith('.jpg') || 
      req.path.endsWith('.ico') || 
      req.path.endsWith('.svg')) {
    return res.status(404).json({ error: 'Asset not found' });
  }
  
  res.sendFile(path.join(frontendPath, 'index.html'));
});

app.use('/api/*', (_req, res) => res.status(404).json({ error: 'API route not found' }));

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message
  });
});

const server = app.listen(PORT, () => {
  
  // Initialize services after server starts
  setTimeout(async () => {
    try {
      // Initialize Beds24 authentication system
      const beds24Service = require('./services/beds24Service');
      await beds24Service.getValidAccessToken();
      console.log('✅ Beds24 authentication system initialized');
      
      // Initialize cron service for automated tasks
      cronService.init();
      console.log('✅ Cron service initialized - automated token refresh active');
      
    } catch (error) {
      console.error('⚠️  Service initialization failed:', error.message);
      if (error.message.includes('No Beds24 authentication data found')) {
        console.log('💡 Run initializeBeds24Tokens.js script to set up initial tokens');
      }
      
      // Even if Beds24 init fails, still try to start cron service
      try {
        cronService.init();
        console.log('✅ Cron service initialized (will retry token refresh automatically)');
      } catch (cronError) {
        console.error('❌ Cron service initialization failed:', cronError.message);
      }
    }
  }, 5000); // Wait 5 seconds after server start
});

// Graceful shutdown handling
const gracefulShutdown = async (signal) => {
  console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);
  
  try {
    // Stop accepting new connections
    server.close(async () => {
      console.log('🔄 HTTP server closed');
      
      // Shutdown cron service
      await cronService.shutdown();
      
      console.log('✅ Graceful shutdown completed');
      process.exit(0);
    });
    
    // Force close after 10 seconds
    setTimeout(() => {
      console.error('❌ Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 10000);
    
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});

module.exports = app;
