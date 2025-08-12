const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

app.set('trust proxy', 1);
// Security middleware
app.use(helmet());
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
const testRoutes = require('./routes/test');
const communicationRoutes = require('./routes/communicationRoutes');

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
app.use('/api/test', testRoutes);
app.use('/api/communication', communicationRoutes);

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

app.listen(PORT, () => {
  console.log(`🚀 StayLabel API running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
});

module.exports = app;
