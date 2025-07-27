require('dotenv').config();
const { supabaseAdmin } = require('../config/supabase');

async function setupStorage() {
  try {
    console.log('Setting up Supabase storage...');

    // Create guest-documents bucket
    const { data: bucket, error: bucketError } = await supabaseAdmin.storage
      .createBucket('guest-documents', {
        public: false,
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'],
        fileSizeLimit: 10485760 // 10MB
      });

    if (bucketError && !bucketError.message.includes('already exists')) {
      throw bucketError;
    }

    console.log('✓ guest-documents bucket created/verified');

    // Set up RLS policies for the bucket
    const policies = [
      {
        name: 'Allow authenticated users to upload',
        definition: `
          CREATE POLICY "Allow authenticated users to upload" ON storage.objects
          FOR INSERT WITH CHECK (bucket_id = 'guest-documents' AND auth.role() = 'authenticated');
        `
      },
      {
        name: 'Allow users to view their own uploads',
        definition: `
          CREATE POLICY "Allow users to view their own uploads" ON storage.objects
          FOR SELECT USING (bucket_id = 'guest-documents' AND auth.role() = 'authenticated');
        `
      },
      {
        name: 'Allow users to delete their own uploads',
        definition: `
          CREATE POLICY "Allow users to delete their own uploads" ON storage.objects
          FOR DELETE USING (bucket_id = 'guest-documents' AND auth.role() = 'authenticated');
        `
      }
    ];

    // Note: RLS policies need to be set up manually in Supabase dashboard or via SQL
    console.log('✓ Storage bucket setup complete');
    console.log('⚠️  Note: You may need to configure RLS policies manually in Supabase dashboard');
    console.log('   Go to Storage > Policies and ensure proper access controls are in place');

  } catch (error) {
    console.error('Error setting up storage:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  setupStorage()
    .then(() => {
      console.log('Storage setup completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Storage setup failed:', error);
      process.exit(1);
    });
}

module.exports = { setupStorage };


