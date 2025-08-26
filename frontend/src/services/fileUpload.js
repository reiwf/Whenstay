import { getSupabaseClient } from './supabaseClient'

// Get Supabase client from singleton service
const supabase = getSupabaseClient()

if (!supabase) {
  console.error('Failed to initialize Supabase client for file upload')
}

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

/**
 * Upload image files for message attachments
 * @param {File[]} files - Array of image files to upload
 * @param {string} messageId - Temporary or actual message ID for organizing files
 * @param {Function} progressCallback - Progress callback (uploaded, total)
 * @returns {Promise<Object[]>} - Array of upload results
 */
export const uploadMessageImages = async (files, messageId = null, progressCallback = null) => {
  try {
    const bucketName = 'message-attachments'
    const results = []
    
    // Create folder path using messageId or timestamp
    const folder = messageId ? `images/${messageId}` : `images/temp-${Date.now()}`
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      
      try {
        if (progressCallback) {
          progressCallback(i, files.length)
        }
        
        // Generate unique filename
        const fileExt = file.name.split('.').pop() || 'jpg'
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
        const filePath = `${folder}/${fileName}`

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

        results.push({
          success: true,
          filePath: data.path,
          publicUrl: urlData.publicUrl,
          fileName: fileName,
          originalName: file.name,
          contentType: file.type,
          size: file.size
        })

      } catch (fileError) {
        console.error(`Failed to upload file ${file.name}:`, fileError)
        results.push({
          success: false,
          error: fileError.message || 'Failed to upload file',
          originalName: file.name
        })
      }
    }
    
    if (progressCallback) {
      progressCallback(files.length, files.length)
    }
    
    return results

  } catch (error) {
    console.error('Message images upload error:', error)
    throw error
  }
}

/**
 * Upload a single message image
 * @param {File} file - Image file to upload
 * @param {string} messageId - Message ID for organizing files
 * @returns {Promise<Object>} - Upload result
 */
export const uploadMessageImage = async (file, messageId = null) => {
  const results = await uploadMessageImages([file], messageId)
  return results[0]
}

/**
 * Create form data for message with images
 * @param {string} content - Message text content
 * @param {File[]} imageFiles - Array of image files
 * @param {Object} additionalData - Additional message data
 * @returns {FormData} - FormData object ready for API submission
 */
export const createMessageFormData = (content, imageFiles = [], additionalData = {}) => {
  const formData = new FormData()
  
  // Add text content
  formData.append('content', content)
  
  // Add image files
  imageFiles.forEach((file, index) => {
    formData.append(`images`, file)
  })
  
  // Add additional data
  Object.keys(additionalData).forEach(key => {
    formData.append(key, additionalData[key])
  })
  
  return formData
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
