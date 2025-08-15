const { supabaseAdmin } = require('../config/supabase');

async function ensureStorageBuckets() {
  try {
    console.log('🪣 Checking and creating storage buckets...');

    const bucketsToCreate = [
      {
        name: 'message-attachments',
        public: true,
        allowedMimeTypes: ['image/*'],
        fileSizeLimit: 10 * 1024 * 1024 // 10MB
      },
      {
        name: 'guest-documents', 
        public: false, // Private bucket for sensitive documents
        allowedMimeTypes: ['image/*', 'application/pdf'],
        fileSizeLimit: 5 * 1024 * 1024 // 5MB
      }
    ];

    for (const bucketConfig of bucketsToCreate) {
      try {
        // Check if bucket exists
        const { data: existingBuckets } = await supabaseAdmin.storage.listBuckets();
        const bucketExists = existingBuckets?.some(b => b.name === bucketConfig.name);

        if (bucketExists) {
          console.log(`  ✅ Bucket '${bucketConfig.name}' already exists`);
          continue;
        }

        // Create bucket
        const { data, error } = await supabaseAdmin.storage.createBucket(
          bucketConfig.name,
          {
            public: bucketConfig.public,
            allowedMimeTypes: bucketConfig.allowedMimeTypes,
            fileSizeLimit: bucketConfig.fileSizeLimit
          }
        );

        if (error) {
          console.error(`  ❌ Error creating bucket '${bucketConfig.name}':`, error);
        } else {
          console.log(`  ✅ Created bucket '${bucketConfig.name}'`);
        }

      } catch (bucketError) {
        console.error(`  ❌ Error with bucket '${bucketConfig.name}':`, bucketError);
      }
    }

    console.log('🎉 Storage bucket setup completed!');

  } catch (error) {
    console.error('❌ Error in ensureStorageBuckets:', error);
  }
}

// Run the script if called directly
if (require.main === module) {
  ensureStorageBuckets()
    .then(() => {
      console.log('Script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Script failed:', error);
      process.exit(1);
    });
}

module.exports = ensureStorageBuckets;
