# Quick Setup Guide

## 🚀 Get Started in 5 Minutes

### 1. Install Dependencies
```bash
# Backend
cd backend && npm install

# Frontend  
cd ../frontend && npm install
```

### 2. Setup Supabase Database
1. Create account at [supabase.com](https://supabase.com)
2. Create new project
3. Copy SQL from `backend/database/schema.sql` and run in Supabase SQL Editor
4. Create storage bucket named `guest-documents`

### 3. Configure Environment
```bash
cd backend
cp .env.example .env
# Fill in your Supabase credentials
```

### 4. Start Development
```bash
# Terminal 1 - Backend
cd backend && npm run dev

# Terminal 2 - Frontend  
cd frontend && npm run dev
```

### 5. Test the App
1. Visit http://localhost:3000
2. Go to Admin panel: http://localhost:3000/admin
3. Login with: admin / admin123
4. Create test reservation
5. Use the generated check-in link

## 🔧 Essential Environment Variables

```env
# Supabase (Required)
SUPABASE_URL=your_project_url
SUPABASE_SERVICE_ROLE_KEY=your_service_key

# Email (Required for notifications)
EMAIL_HOST=smtp.gmail.com
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password

# Beds24 (Optional for testing)
BEDS24_API_KEY=your_api_key
BEDS24_PROP_KEY=your_property_key
```

## 📱 Demo Flow

1. **Admin creates test reservation** → Gets check-in URL
2. **Guest visits check-in URL** → Fills form + uploads passport
3. **Admin reviews submission** → Verifies guest information
4. **Guest receives confirmation** → Ready for arrival

## 🎯 Key Features Working

✅ Guest check-in form with file upload  
✅ Admin dashboard with statistics  
✅ Email notifications  
✅ Beds24 API integration  
✅ Webhook support  
✅ Secure file storage  
✅ Responsive design  

## 🔗 Important URLs

- **Frontend**: http://localhost:3000
- **Admin Panel**: http://localhost:3000/admin  
- **API**: http://localhost:3001/api
- **Check-in**: http://localhost:3000/checkin/[token]

## 🆘 Need Help?

Check the main README.md for detailed documentation and troubleshooting.
