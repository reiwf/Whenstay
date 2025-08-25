import { createClient } from '@supabase/supabase-js'

// Singleton pattern for Supabase client to prevent multiple instances
class SupabaseService {
  constructor() {
    this.client = null
    this.adminClient = null
  }

  // Initialize the regular Supabase client (anon key)
  getClient() {
    if (!this.client) {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

      if (!supabaseUrl || !supabaseAnonKey) {
        console.error('Missing Supabase environment variables')
        return null
      }

      this.client = createClient(supabaseUrl, supabaseAnonKey)
      
      if (import.meta.env.MODE === 'development') {
      }
    }
    return this.client
  }

  // Initialize the admin Supabase client (service role key)
  getAdminClient() {
    if (!this.adminClient) {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

      if (!supabaseUrl) {
        console.error('Missing Supabase URL environment variable')
        return null
      }

      // Use service role key if available, otherwise fall back to anon key
      const key = supabaseServiceKey || supabaseAnonKey
      
      if (!key) {
        console.error('Missing Supabase keys (both service role and anon key)')
        return null
      }

      this.adminClient = createClient(supabaseUrl, key)

      if (import.meta.env.MODE === 'development') {
        if (supabaseServiceKey) {
        } else {
        }
      }
    }
    return this.adminClient
  }

  // Environment check utility
  checkEnvironment() {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
    const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY

    if (import.meta.env.MODE === 'development') {
    }

    return {
      url: !!supabaseUrl,
      anonKey: !!supabaseAnonKey,
      serviceKey: !!supabaseServiceKey
    }
  }

  // Cleanup method (useful for testing or manual cleanup)
  cleanup() {
    if (this.client) {
      // Remove all channels if any exist
      this.client.getChannels().forEach(channel => {
        this.client.removeChannel(channel)
      })
    }
    if (this.adminClient) {
      // Remove all channels if any exist
      this.adminClient.getChannels().forEach(channel => {
        this.adminClient.removeChannel(channel)
      })
    }
    this.client = null
    this.adminClient = null
  }
}

// Create and export singleton instance
const supabaseService = new SupabaseService()

// Named exports for convenience
export const getSupabaseClient = () => supabaseService.getClient()
export const getSupabaseAdminClient = () => supabaseService.getAdminClient()
export const checkSupabaseEnvironment = () => supabaseService.checkEnvironment()

// Default export
export default supabaseService
