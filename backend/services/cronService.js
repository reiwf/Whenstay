const cron = require('node-cron');
const beds24Service = require('./beds24Service');

class CronService {
  constructor() {
    this.cronJobs = new Map();
    this.isInitialized = false;
  }

  // Initialize all cron jobs
  init() {
    if (this.isInitialized) {
      console.log('⚠️  Cron service already initialized');
      return;
    }

    console.log('🔄 Initializing cron service...');

    // Start Beds24 token refresh job
    this.startBeds24TokenRefreshJob();

    this.isInitialized = true;
    console.log('✅ Cron service initialized successfully');
  }

  // Start the Beds24 token refresh cron job
  startBeds24TokenRefreshJob() {
    // Run every 20 hours (cron expression: 0 */20 * * *)
    // This gives us a 4-hour safety buffer before the 24-hour token expiry
    const cronExpression = '0 */20 * * *'; // At minute 0 of every 20th hour
    
    const task = cron.schedule(cronExpression, async () => {
      await this.refreshBeds24Token();
    }, {
      scheduled: false, // Don't start automatically
      timezone: 'Asia/Tokyo' // Use JST timezone
    });

    // Store the task for later management
    this.cronJobs.set('beds24TokenRefresh', task);

    // Start the task
    task.start();

    console.log('✅ Beds24 token refresh cron job scheduled');
    console.log(`📅 Schedule: Every 20 hours (${cronExpression})`);
    console.log('🌏 Timezone: Asia/Tokyo (JST)');
    
    // Log next execution time
    const nextExecution = this.getNextExecutionTime(cronExpression);
    console.log(`⏰ Next execution: ${nextExecution}`);
  }

  // Refresh Beds24 token with comprehensive error handling
  async refreshBeds24Token() {
    const startTime = new Date();
    console.log(`🔄 [${startTime.toISOString()}] Starting scheduled Beds24 token validation/refresh...`);

    let attempt = 1;
    const maxAttempts = 3;
    const baseDelayMs = 5000; // 5 seconds

    while (attempt <= maxAttempts) {
      try {
        // Use getValidAccessToken instead of refreshAccessToken
        // This checks validity first and only refreshes if needed
        const validToken = await beds24Service.getValidAccessToken();
        
        const endTime = new Date();
        const durationMs = endTime.getTime() - startTime.getTime();
        
        console.log(`✅ [${endTime.toISOString()}] Beds24 token validated/refreshed successfully`);
        console.log(`⏱️  Duration: ${durationMs}ms`);
        console.log(`🔑 Valid token length: ${validToken ? validToken.length : 'N/A'} chars`);
        
        // Log next scheduled refresh
        const nextRefresh = this.getNextExecutionTime('0 */20 * * *');
        console.log(`📅 Next refresh scheduled: ${nextRefresh}`);
        
        return; // Success, exit retry loop
        
      } catch (error) {
        const errorTime = new Date();
        console.error(`❌ [${errorTime.toISOString()}] Beds24 token refresh failed (attempt ${attempt}/${maxAttempts}):`, {
          error: error.message,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
          attempt,
          maxAttempts
        });

        // If this was the last attempt, log final failure
        if (attempt === maxAttempts) {
          console.error(`🚨 [${errorTime.toISOString()}] Beds24 token refresh failed after ${maxAttempts} attempts`);
          console.error('💡 Manual intervention may be required. Check Beds24 API status and refresh token validity.');
          
          // In production, you might want to send alerts here
          if (process.env.NODE_ENV === 'production') {
            console.error('🔔 ALERT: Beds24 token refresh service has failed. Manual attention required.');
          }
          
          return; // Give up after max attempts
        }

        // Calculate delay with exponential backoff
        const delayMs = baseDelayMs * Math.pow(2, attempt - 1);
        console.log(`⏳ Waiting ${delayMs}ms before retry ${attempt + 1}...`);
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, delayMs));
        attempt++;
      }
    }
  }

  // Get next execution time for a cron expression (helper for logging)
  getNextExecutionTime(cronExpression) {
    try {
      // Simple approximation for logging purposes
      const now = new Date();
      const next = new Date(now.getTime() + (20 * 60 * 60 * 1000)); // Add 20 hours
      return next.toLocaleString('en-US', {
        timeZone: 'Asia/Tokyo',
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZoneName: 'short'
      });
    } catch (error) {
      return 'Unable to calculate';
    }
  }

  // Manually trigger Beds24 token refresh (useful for testing)
  async triggerBeds24Refresh() {
    console.log('🔧 Manual Beds24 token refresh triggered');
    await this.refreshBeds24Token();
  }

  // Stop a specific cron job
  stopJob(jobName) {
    const job = this.cronJobs.get(jobName);
    if (job) {
      job.stop();
      console.log(`⏹️  Stopped cron job: ${jobName}`);
      return true;
    }
    console.log(`⚠️  Cron job not found: ${jobName}`);
    return false;
  }

  // Start a specific cron job
  startJob(jobName) {
    const job = this.cronJobs.get(jobName);
    if (job) {
      job.start();
      console.log(`▶️  Started cron job: ${jobName}`);
      return true;
    }
    console.log(`⚠️  Cron job not found: ${jobName}`);
    return false;
  }

  // Get status of all cron jobs
  getJobsStatus() {
    const status = {};
    this.cronJobs.forEach((job, name) => {
      status[name] = {
        running: job.running || false,
        scheduled: job.scheduled || false
      };
    });
    return status;
  }

  // Stop all cron jobs (useful for graceful shutdown)
  stopAll() {
    console.log('🛑 Stopping all cron jobs...');
    this.cronJobs.forEach((job, name) => {
      job.stop();
      console.log(`⏹️  Stopped: ${name}`);
    });
    console.log('✅ All cron jobs stopped');
  }

  // Graceful shutdown
  async shutdown() {
    console.log('🔄 Shutting down cron service...');
    this.stopAll();
    this.cronJobs.clear();
    this.isInitialized = false;
    console.log('✅ Cron service shut down gracefully');
  }
}

// Create and export a singleton instance
const cronService = new CronService();

module.exports = cronService;
