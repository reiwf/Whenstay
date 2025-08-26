const cron = require('node-cron');
const beds24Service = require('./beds24Service');
const { supabaseAdmin } = require('../config/supabase');
const communicationService = require('./communicationService');
const smartMarketDemandService = require('./smartMarketDemandService');

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

    // Start scheduled message processing job
    this.startScheduledMessageProcessingJob();

    // Start pricing-related cron jobs
    this.startPricingCronJobs();

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

  // Start the scheduled message processing cron job
  startScheduledMessageProcessingJob() {
    // Run every minute to process due scheduled messages
    const cronExpression = '* * * * *'; // Every minute
    
    const task = cron.schedule(cronExpression, async () => {
      await this.processScheduledMessages();
    }, {
      scheduled: false, // Don't start automatically
      timezone: 'Asia/Tokyo' // Use JST timezone
    });

    // Store the task for later management
    this.cronJobs.set('scheduledMessageProcessing', task);

    // Start the task
    task.start();

    console.log('✅ Scheduled message processing cron job scheduled');
    console.log(`📅 Schedule: Every minute (${cronExpression})`);
    console.log('🌏 Timezone: Asia/Tokyo (JST)');
  }

  // Process due scheduled messages
  async processScheduledMessages(forceProcess = false) {
    try {
      // Check environment flags before processing (unless forced)
      if (!forceProcess) {
        const isDevelopment = process.env.NODE_ENV === 'development';
        const enableScheduledMessages = process.env.ENABLE_SCHEDULED_MESSAGES === 'true';

        if (isDevelopment && !enableScheduledMessages) {
          // Log every 10 minutes to avoid spam but inform about disabled state
          if (Math.floor(Date.now() / 600000) % 1 === 0) {
            // console.log('📭 Scheduled message processing disabled in development mode');
            // console.log('💡 Set ENABLE_SCHEDULED_MESSAGES=true in .env to enable, or use triggerScheduledMessageProcessingForced() for testing');
          }
          return;
        }
      }

      const startTime = new Date();
      
      // Use the Supabase function to claim due messages (up to 50 at a time)
      const dueMessages = await communicationService.getDueScheduledMessages(50);
      
      if (!dueMessages || dueMessages.length === 0) {
        // Only log every 10th run to avoid log spam
        if (Math.floor(Date.now() / 60000) % 10 === 0) {
          const environment = process.env.NODE_ENV || 'unknown';
          console.log(`📭 No scheduled messages due for processing (${environment} environment)`);
        }
        return;
      }

      console.log(`📨 Processing ${dueMessages.length} due scheduled messages...`);

      const results = { success: 0, failed: 0 };

      // Process each claimed message
      for (const scheduledMessage of dueMessages) {
        try {
          await this.processIndividualScheduledMessage(scheduledMessage);
          results.success++;
        } catch (error) {
          console.error(`Error processing scheduled message ${scheduledMessage.id}:`, error);
          results.failed++;
        }
      }

      const endTime = new Date();
      const durationMs = endTime.getTime() - startTime.getTime();

      console.log(`✅ Scheduled message processing complete:`, {
        processed: dueMessages.length,
        successful: results.success,
        failed: results.failed,
        duration: `${durationMs}ms`
      });

    } catch (error) {
      console.error('❌ Error in scheduled message processing:', error);
    }
  }

  // Process an individual scheduled message
  async processIndividualScheduledMessage(scheduledMessage) {
    const { supabaseAdmin } = require('../config/supabase');
    
    try {
      console.log(`Processing scheduled message ${scheduledMessage.id} for template ${scheduledMessage.template_id}`);

      // Render template with variables
      const rendered = await communicationService.renderTemplate(
        scheduledMessage.template_id,
        scheduledMessage.payload || {}
      );

      // For inapp messages, create the message directly without external routing
      let message;
      if (scheduledMessage.channel === 'inapp') {
        // Create message directly in the database for inapp channel
        message = await communicationService.receiveMessage({
          thread_id: scheduledMessage.thread_id,
          channel: 'inapp',
          content: rendered.rendered_content,
          origin_role: 'system', // System-generated automated message
          direction: 'outgoing'
        });
        console.log(`📱 Created inapp scheduled message ${message.id} for thread ${scheduledMessage.thread_id}`);
      } else {
        // For external channels, use the normal send flow
        message = await communicationService.sendMessage({
          thread_id: scheduledMessage.thread_id,
          channel: scheduledMessage.channel,
          content: rendered.rendered_content,
          origin_role: 'system' // System-generated automated message
        });
        console.log(`📤 Sent external scheduled message ${message.id} via ${scheduledMessage.channel}`);
      }

      // Mark scheduled message as sent
      const { error: updateError } = await supabaseAdmin
        .from('scheduled_messages')
        .update({ 
          status: 'sent',
          updated_at: new Date().toISOString()
        })
        .eq('id', scheduledMessage.id);

      if (updateError) {
        throw new Error(`Failed to update scheduled message status: ${updateError.message}`);
      }

      console.log(`✅ Successfully processed scheduled message ${scheduledMessage.id} -> message ${message.id}`);
      return message;

    } catch (error) {
      console.error(`❌ Error processing scheduled message ${scheduledMessage.id}:`, error);

      // Mark as failed with error details
      try {
        const { supabaseAdmin } = require('../config/supabase');
        await supabaseAdmin
          .from('scheduled_messages')
          .update({ 
            status: 'failed',
            last_error: error.message,
            updated_at: new Date().toISOString()
          })
          .eq('id', scheduledMessage.id);
      } catch (updateError) {
        console.error(`Failed to update failed scheduled message ${scheduledMessage.id}:`, updateError);
      }

      throw error;
    }
  }

  // Manually trigger scheduled message processing (useful for testing)
  async triggerScheduledMessageProcessing() {
    console.log('🔧 Manual scheduled message processing triggered');
    await this.processScheduledMessages();
  }

  // Force scheduled message processing (bypasses environment checks - useful for development testing)
  async triggerScheduledMessageProcessingForced() {
    console.log('🔧 FORCED scheduled message processing (bypassing environment checks)');
    console.log('⚠️  This will process messages even in development mode');
    await this.processScheduledMessages(true); // true = force processing
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

  // Start pricing-related cron jobs
  startPricingCronJobs() {
    // Market factor updates - run daily at 2 AM JST
    const marketFactorCron = '0 2 * * *';
    const marketTask = cron.schedule(marketFactorCron, async () => {
      await this.updateMarketFactors();
    }, {
      scheduled: false,
      timezone: 'Asia/Tokyo'
    });

    this.cronJobs.set('marketFactorUpdate', marketTask);
    marketTask.start();

    // Pricing queue processor - run every 5 minutes
    const queueCron = '*/5 * * * *';
    const queueTask = cron.schedule(queueCron, async () => {
      await this.processPricingQueue();
    }, {
      scheduled: false,
      timezone: 'Asia/Tokyo'
    });

    this.cronJobs.set('pricingQueueProcessor', queueTask);
    queueTask.start();

    console.log('✅ Pricing cron jobs scheduled');
    console.log(`📅 Market factors: Daily at 2 AM JST (${marketFactorCron})`);
    console.log(`📅 Pricing queue: Every 5 minutes (${queueCron})`);
  }

  // Update market factors using smart market demand calculations - OPTIMIZED VERSION
  async updateMarketFactors() {
    try {
      console.log('🧠 [OPTIMIZED] Updating smart market factors...');
      const startTime = new Date();

      // Get all active room types to calculate smart factors for
      const { data: roomTypes, error: rtError } = await supabaseAdmin
        .from('room_types')
        .select('id, base_price, property_id')
        .eq('is_active', true)
        .not('base_price', 'is', null);

      if (rtError) {
        throw rtError;
      }

      if (!roomTypes || roomTypes.length === 0) {
        console.log('📭 No active room types found with base prices');
        return;
      }

      // Calculate smart factors for each room type
      const fromDate = new Date().toISOString().split('T')[0]; // Today
      const toDate = new Date(Date.now() + (180 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0]; // Next 180 days
      
      console.log(`📊 Processing ${roomTypes.length} room types from ${fromDate} to ${toDate}`);

      // Process room types in parallel batches to improve performance
      const batchSize = 3; // Process 3 room types simultaneously to avoid overwhelming the database
      let totalUpdated = 0;
      const results = [];

      for (let i = 0; i < roomTypes.length; i += batchSize) {
        const batch = roomTypes.slice(i, i + batchSize);
        console.log(`🔄 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(roomTypes.length/batchSize)} (${batch.length} room types)`);

        // Process batch in parallel
        const batchPromises = batch.map(async (roomType) => {
          try {
            // Use property_id as location_id, or null for global
            const locationId = roomType.property_id || null;
            
            const result = await smartMarketDemandService.updateSmartMarketFactors(
              roomType.id,
              fromDate,
              toDate,
              locationId
            );

            if (result.success) {
              console.log(`✅ Room type ${roomType.id}: ${result.updated} records updated`);
              return { roomTypeId: roomType.id, updated: result.updated, success: true };
            } else {
              console.log(`⚠️ Room type ${roomType.id}: No updates`);
              return { roomTypeId: roomType.id, updated: 0, success: false };
            }

          } catch (roomTypeError) {
            console.error(`❌ Error updating factors for room type ${roomType.id}:`, roomTypeError);
            return { roomTypeId: roomType.id, updated: 0, success: false, error: roomTypeError.message };
          }
        });

        // Wait for batch to complete
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
        
        // Add small delay between batches to prevent overwhelming the database
        if (i + batchSize < roomTypes.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      // Calculate totals and summary
      totalUpdated = results.reduce((sum, r) => sum + r.updated, 0);
      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();
      
      console.log(`✅ [OPTIMIZED] Smart market factors completed:`);
      console.log(`   📊 Total records updated: ${totalUpdated}`);
      console.log(`   🏠 Room types processed: ${roomTypes.length} (${successCount} success, ${failureCount} failed)`);
      console.log(`   ⏱️  Total duration: ${(duration/1000).toFixed(1)}s`);
      console.log(`   ⚡ Average performance: ${(totalUpdated/(duration/1000)).toFixed(0)} records/second`);

      // Log any failures for investigation
      const failures = results.filter(r => !r.success);
      if (failures.length > 0) {
        console.log(`⚠️ Failed room types:`, failures.map(f => `${f.roomTypeId}: ${f.error || 'Unknown error'}`));
      }

      // Also ensure basic market factors exist for dates without specific room type calculations
      await this.ensureBasicMarketFactors();

    } catch (error) {
      console.error('❌ Error updating smart market factors:', error);
    }
  }

  // Ensure basic market factors exist as fallback (legacy compatibility)
  async ensureBasicMarketFactors() {
    try {
      // Generate basic market factors for the next 180 days where they don't exist
      const fromDate = new Date();
      const toDate = new Date(fromDate.getTime() + (180 * 24 * 60 * 60 * 1000));
      
      const factorsToInsert = [];
      
      for (let d = new Date(fromDate); d <= toDate; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        const month = d.getMonth() + 1; // 1-12
        const dayOfWeek = d.getDay(); // 0 = Sunday

        // Simple seasonality curve (fallback)
        let seasonality;
        if ([12, 1, 2].includes(month)) seasonality = 0.92; // Winter
        else if ([3, 4, 5].includes(month)) seasonality = 0.97; // Spring  
        else if ([6, 7, 8].includes(month)) seasonality = 1.15; // Summer
        else seasonality = 1.05; // Fall

        // Weekend demand boost (fallback)
        let demand = 1.0;
        if (dayOfWeek === 5 || dayOfWeek === 6) demand = 1.08; // Fri, Sat
        else if (dayOfWeek === 0) demand = 1.05; // Sun

        factorsToInsert.push({
          location_id: null, // Global factors
          dt: dateStr,
          demand,
          demand_auto: demand,
          comp_pressure_auto: 1.0,
          manual_multiplier: 1.0,
          events_weight: 1.0
        });
      }

      // Only insert where records don't already exist
      const { error } = await supabaseAdmin
        .from('market_factors')
        .upsert(factorsToInsert, { 
          onConflict: 'location_id,dt',
          ignoreDuplicates: true // Don't overwrite existing smart calculations
        });

      if (error) {
        console.error('Error ensuring basic market factors:', error);
      } else {
        console.log(`📅 Ensured basic market factors exist for ${factorsToInsert.length} dates`);
      }

    } catch (error) {
      console.error('❌ Error ensuring basic market factors:', error);
    }
  }

  // Process pricing recalculation queue
  async processPricingQueue() {
    try {
      // Call the database function to process queue items
      const { data, error } = await supabaseAdmin.rpc('process_pricing_queue');
      
      if (error) {
        throw error;
      }

      if (data > 0) {
        console.log(`💰 Processed ${data} pricing queue items`);
      }

      // Cleanup old completed items
      await supabaseAdmin.rpc('cleanup_pricing_queue');

    } catch (error) {
      console.error('❌ Error processing pricing queue:', error);
    }
  }

  // Manually trigger market factor update (useful for testing)
  async triggerMarketFactorUpdate() {
    console.log('🔧 Manual market factor update triggered');
    await this.updateMarketFactors();
  }

  // Manually trigger pricing queue processing (useful for testing)
  async triggerPricingQueueProcess() {
    console.log('🔧 Manual pricing queue processing triggered');
    await this.processPricingQueue();
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
