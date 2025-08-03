require('dotenv').config();
const { supabaseAdmin } = require('../config/supabase');

async function createTestUserProfile() {
  try {
    console.log('Creating test user profile...');
    
    // First, create the auth user
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: 'admin@whenstay.com',
      password: 'admin123',
      email_confirm: true
    });
    
    if (authError) {
      if (authError.message.includes('already registered') || authError.code === 'email_exists') {
        console.log('Auth user already exists, fetching existing user...');
        
        // Get existing user
        const { data: existingUsers, error: fetchError } = await supabaseAdmin.auth.admin.listUsers();
        if (fetchError) {
          throw fetchError;
        }
        
        const existingUser = existingUsers.users.find(u => u.email === 'admin@whenstay.com');
        if (!existingUser) {
          throw new Error('User exists but could not be found');
        }
        
        console.log('Found existing auth user:', existingUser.id);
        
        // Check if profile already exists
        const { data: existingProfile, error: profileCheckError } = await supabaseAdmin
          .from('user_profiles')
          .select('*')
          .eq('id', existingUser.id)
          .single();
        
        if (profileCheckError && profileCheckError.code !== 'PGRST116') {
          throw profileCheckError;
        }
        
        if (existingProfile) {
          console.log('Profile already exists:', existingProfile);
          return existingProfile;
        }
        
        // Create profile for existing user
        const { data: newProfile, error: profileError } = await supabaseAdmin
          .from('user_profiles')
          .insert({
            id: existingUser.id,
            role: 'admin',
            first_name: 'Admin',
            last_name: 'User',
            phone: '+1234567890',
            company_name: 'Whenstay',
            is_active: true
          })
          .select()
          .single();
        
        if (profileError) {
          throw profileError;
        }
        
        console.log('Created profile for existing user:', newProfile);
        return newProfile;
      } else {
        throw authError;
      }
    }
    
    console.log('Created auth user:', authUser.user.id);
    
    // Create the user profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .insert({
        id: authUser.user.id,
        role: 'admin',
        first_name: 'Admin',
        last_name: 'User',
        phone: '+1234567890',
        company_name: 'Whenstay',
        is_active: true
      })
      .select()
      .single();
    
    if (profileError) {
      throw profileError;
    }
    
    console.log('Created user profile:', profile);
    
    console.log('\n✅ Test admin user created successfully!');
    console.log('📧 Email: admin@whenstay.com');
    console.log('🔑 Password: admin123');
    console.log('👤 Role: admin');
    
    return profile;
    
  } catch (error) {
    console.error('❌ Error creating test user profile:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  createTestUserProfile()
    .then(() => {
      console.log('\n🎉 Script completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Script failed:', error);
      process.exit(1);
    });
}

module.exports = { createTestUserProfile };
