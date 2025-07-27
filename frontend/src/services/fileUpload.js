import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)

export const uploadFile = async (file, bucketName = 'guest-documents', folder = '') => {
  try {
    // Generate unique filename
    const fileExt = file.name.split('.').pop()
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
    const filePath = folder ? `${folder}/${fileName}` : fileName

    // Upload file to Supabase storage
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      })

    if (error) {
      throw error
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(filePath)

    return {
      success: true,
      filePath: data.path,
      publicUrl: urlData.publicUrl,
      fileName: fileName
    }
  } catch (error) {
    console.error('File upload error:', error)
    return {
      success: false,
      error: error.message || 'Failed to upload file'
    }
  }
}

export const deleteFile = async (filePath, bucketName = 'guest-documents') => {
  try {
    const { error } = await supabase.storage
      .from(bucketName)
      .remove([filePath])

    if (error) {
      throw error
    }

    return { success: true }
  } catch (error) {
    console.error('File delete error:', error)
    return {
      success: false,
      error: error.message || 'Failed to delete file'
    }
  }
}
