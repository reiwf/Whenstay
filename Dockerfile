# Multi-stage build for StayLabel App
FROM node:18-alpine AS frontend-builder

# Set working directory for frontend build
WORKDIR /app

# 1) Copy root lockfile (workspaces lockfile)
COPY package.json package-lock.json ./

# 2) Copy the workspace manifest so npm can resolve it
COPY frontend/package.json frontend/package.json

# Install frontend dependencies (including devDependencies for build)
RUN npm ci --workspace frontend

# Copy frontend source code
COPY frontend/ frontend/

# Set build-time environment variables for Vite
ARG VITE_SUPABASE_URL=https://nwdsuuwlmockdqzxkkbm.supabase.co
ARG VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53ZHN1dXdsbW9ja2Rxenhra2JtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQzNjcwMDAsImV4cCI6MjA2OTk0MzAwMH0.khvKCebuExSq3YiM6QUag5jrhcYeGLTn9EbYK7Chrrw
ARG VITE_API_URL=/api

# Set environment variables for the build
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV VITE_API_URL=$VITE_API_URL

# Build frontend for production
WORKDIR /app/frontend
RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app directory
WORKDIR /app

# Copy root workspace configuration files first
COPY package.json package-lock.json ./

# Copy backend package files
COPY backend/package*.json backend/

# Install backend dependencies (production only)
RUN npm ci --workspace backend --only=production && npm cache clean --force

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

# Copy backend source code
COPY backend/ ./backend/

# Copy built frontend from previous stage
COPY --from=frontend-builder /app/frontend/dist ./backend/frontend/dist

# Change ownership to nodejs user
RUN chown -R nodejs:nodejs /app
USER nodejs

# Set working directory to backend for runtime
WORKDIR /app/backend

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application with dumb-init
ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "start"]
