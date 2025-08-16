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

// Security middleware with custom CSP
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: [
        "'self'",
        "https://nwdsuuwlmockdqzxkkbm.supabase.co",
        "wss://nwdsuuwlmockdqzxkkbm.supabase.co",
        "https://api.staylabel.com",
        "wss://api.staylabel.com"
      ],
      imgSrc: [
        "'self'",
        "https://nwdsuuwlmockdqzxkkbm.supabase.co",
        "https://api.staylabel.com",
        "data:"
      ],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: []
    }
  }
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

// Body parsing middleware
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

// Serve static files from frontend build
const frontendPath = path.resolve(__dirname, 'frontend', 'dist');
console.log('Serving SPA from:', frontendPath);

app.use(express.static(frontendPath, {
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : '0',
  etag: true,
  lastModified: true
}));

// SPA fallback - serve index.html for all non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// API 404 handler (for /api routes only)
app.get(/^\/(?!api)(.*)/, (req, res) => {
  res.sendFile('index.html', { root: frontendPath });
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
  console.log(`🚀 StayLabel API running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  
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
