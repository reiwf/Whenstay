# Whenstay - Holiday Rental Management Platform

A comprehensive property management web app tailored for individual holiday rental owners, featuring multi-role dashboards, cleaning task management, and guest services.

## 🚀 Features

### Core Functionality
- **Multi-Role System**: Admin, Owner, Guest, and Cleaner dashboards
- **Online Check-in**: Guests complete check-in forms before arrival
- **Guest Dashboard**: WiFi info, amenities, local guides, and support
- **Owner Analytics**: Revenue tracking, occupancy rates, property management
- **Cleaning Task System**: Mobile-friendly cleaner dashboard with photo uploads
- **Admin Control**: Comprehensive management of all users and properties
- **Beds24 Integration**: Automatic booking sync via API and webhooks
- **Email Notifications**: Automated invitations and confirmations
- **File Upload**: Secure passport/ID document storage

### Security & Performance
- **Tokenized Links**: Unique, secure check-in URLs for each reservation
- **Data Encryption**: Secure storage of guest documents and information
- **Real-time Sync**: Webhook-based updates from Beds24
- **Responsive Design**: Works on all devices

## 🏗️ Architecture

```
whenstay-checkin/
├── backend/                 # Node.js Express API
│   ├── config/             # Database and service configurations
│   ├── services/           # Business logic (Beds24, Email, Database)
│   ├── routes/             # API endpoints
│   ├── middleware/         # Custom middleware
│   ├── utils/              # Utility functions
│   └── database/           # SQL schema and migrations
├── frontend/               # React application
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Page components
│   │   ├── services/       # API client and utilities
│   │   ├── hooks/          # Custom React hooks
│   │   └── utils/          # Frontend utilities
└── shared/                 # Shared types and utilities
```

## 🛠️ Tech Stack

### Backend
- **Node.js** with Express.js
- **Supabase** (PostgreSQL database + storage)
- **Beds24 API** integration
- **Nodemailer** for email services
- **Multer** for file uploads

### Frontend
- **React 18** with Vite
- **TailwindCSS** for styling
- **React Router** for navigation
- **React Hook Form** for form handling
- **Axios** for API calls
- **React Hot Toast** for notifications

## 📋 Prerequisites

- Node.js 18+ and npm
- Supabase account and project
- Beds24 account with API access
- Email service (Gmail, SendGrid, etc.)

## 🚀 Quick Start

### 1. Clone and Install

```bash
git clone <repository-url>
cd whenstay-checkin

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 2. Database Setup

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Run the SQL schema in your Supabase SQL editor:

```sql
-- Copy and paste the contents of backend/database/schema.sql
```

3. Create a storage bucket named `guest-documents` in Supabase Storage

### 3. Environment Configuration

Create `backend/.env` from the example:

```bash
cd backend
cp .env.example .env
```

Fill in your configuration:

```env
# Server Configuration
PORT=3001
NODE_ENV=development

# Supabase Configuration
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Beds24 API Configuration
BEDS24_API_KEY=your_beds24_api_key
BEDS24_PROP_KEY=your_beds24_property_key
BEDS24_API_URL=https://beds24.com/api/v2

# Email Configuration (Gmail example)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
EMAIL_FROM=your_email@gmail.com

# Application URLs
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:3001

# Admin Configuration
ADMIN_TOKEN=your_secure_admin_token
```

### 4. Start Development Servers

```bash
# Terminal 1: Start backend
cd backend
npm run dev

# Terminal 2: Start frontend
cd frontend
npm run dev
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001

## 📖 Usage Guide

### For Guests

1. **Receive Check-in Link**: Guests receive a unique link via email after booking
2. **Complete Check-in Form**: Upload passport/ID, provide address, arrival time, and travel purpose
3. **Get Confirmation**: Receive confirmation once admin verifies the submission

### For Administrators

1. **Login**: Access admin dashboard at `/admin` (demo: admin/admin123)
2. **View Dashboard**: Monitor check-in statistics and recent submissions
3. **Verify Submissions**: Review and approve guest check-ins
4. **Sync Bookings**: Manually sync with Beds24 or set up webhooks

## 🔧 API Endpoints

### Guest Endpoints
- `GET /api/checkin/:token` - Get reservation details
- `POST /api/checkin/:token/submit` - Submit check-in form
- `GET /api/checkin/:token/status` - Check submission status

### Admin Endpoints
- `POST /api/admin/login` - Admin authentication
- `GET /api/admin/dashboard/stats` - Dashboard statistics
- `GET /api/admin/checkins` - List all check-ins
- `PATCH /api/admin/checkins/:id/verify` - Verify check-in

### Webhook Endpoints
- `POST /api/webhooks/beds24` - Beds24 webhook receiver
- `POST /api/webhooks/test` - Test webhook functionality

## 🔗 Beds24 Integration

### API Setup
1. Get your API key from Beds24 account settings
2. Configure property key for your specific property
3. Set up webhook URL: `https://yourdomain.com/api/webhooks/beds24`

### Webhook Events
The system handles these Beds24 webhook events:
- `booking_new` - New booking created
- `booking_modified` - Booking updated
- `booking_cancelled` - Booking cancelled

### Manual Sync
Use the admin dashboard to manually sync recent bookings:
```bash
POST /api/admin/sync/beds24
{
  "daysBack": 7
}
```

## 📧 Email Configuration

### Gmail Setup
1. Enable 2-factor authentication
2. Generate an app password
3. Use app password in EMAIL_PASS

### SendGrid Setup
```env
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_USER=apikey
EMAIL_PASS=your_sendgrid_api_key
```

## 🚀 Deployment

### Backend Deployment (Railway/Heroku)
1. Set environment variables
2. Deploy from Git repository
3. Run database migrations

### Frontend Deployment (Vercel/Netlify)
1. Build the project: `npm run build`
2. Deploy the `dist` folder
3. Configure API proxy settings

### Environment Variables for Production
```env
NODE_ENV=production
FRONTEND_URL=https://yourdomain.com
BACKEND_URL=https://api.yourdomain.com
```

## 🧪 Testing

### Create Test Reservation
```bash
curl -X POST http://localhost:3001/api/reservations/test \
  -H "Content-Type: application/json" \
  -d '{
    "guestName": "John Doe",
    "guestEmail": "john@example.com",
    "checkInDate": "2024-01-15",
    "checkOutDate": "2024-01-17",
    "roomNumber": "101"
  }'
```

### Test Webhook
```bash
curl -X POST http://localhost:3001/api/webhooks/test \
  -H "Content-Type: application/json" \
  -d '{}'
```

## 🔒 Security Considerations

- All check-in links use UUID tokens
- File uploads are validated and size-limited
- Admin routes require authentication
- Guest documents are stored securely in Supabase
- Environment variables for sensitive data

## 📝 Database Schema

Key tables:
- `reservations` - Booking data from Beds24
- `guest_checkins` - Guest submission data
- `webhook_events` - Webhook event log

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For issues and questions:
1. Check the troubleshooting section below
2. Review the API documentation
3. Create an issue in the repository

## 🔧 Troubleshooting

### Common Issues

**Database Connection Error**
- Verify Supabase credentials
- Check if database schema is properly set up

**Email Not Sending**
- Verify email service credentials
- Check spam folder
- Ensure app passwords are used for Gmail

**Beds24 Sync Issues**
- Verify API credentials
- Check webhook URL configuration
- Review webhook event logs

**File Upload Errors**
- Check Supabase storage bucket permissions
- Verify file size limits
- Ensure proper CORS configuration

### Debug Mode
Set `NODE_ENV=development` for detailed error logs.

## 🔄 Updates and Maintenance

- Regularly update dependencies
- Monitor webhook event logs
- Backup database regularly
- Review and rotate API keys
