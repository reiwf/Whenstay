const { supabaseAdmin } = require('../config/supabase');

class ImageProcessingService {
  constructor() {
    this.supabase = supabaseAdmin;
  }

  // Check if a URL is an AWS S3 signed URL that will expire
  isSignedUrl(url) {
    if (!url) return false;
    
    // Common patterns for signed URLs
    const signedUrlPatterns = [
      /amazonaws\.com.*[?&]X-Amz-Signature/,
      /amazonaws\.com.*[?&]AWSAccessKeyId/,
      /amazonaws\.com.*[?&]Signature/,
      /[?&]X-Amz-Expires/,
      /[?&]expires=/i
    ];
    
    return signedUrlPatterns.some(pattern => pattern.test(url));
  }

  // Extract image URLs from message content
  extractImageUrls(content) {
    if (!content) return [];
    
    const urls = [];
    
    // Extract from HTML img tags
    const imgTagRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
    let match;
    while ((match = imgTagRegex.exec(content)) !== null) {
      urls.push(match[1]);
    }
    
    // Extract direct URLs that look like images
    const urlRegex = /https?:\/\/[^\s<>"']+\.(?:jpg|jpeg|png|gif|webp)(?:\?[^\s<>"']*)?/gi;
    const urlMatches = content.match(urlRegex) || [];
    urls.push(...urlMatches);
    
    return [...new Set(urls)]; // Remove duplicates
  }

  // Download image from signed URL and upload to Supabase Storage
  async downloadAndStoreImage(imageUrl, messageId) {
    try {
      console.log(`Downloading image from signed URL: ${imageUrl.substring(0, 100)}...`);
      
      // Download the image
      const response = await fetch(imageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; WhenStay/1.0)',
        },
        timeout: 30000, // 30 second timeout
      });

      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.startsWith('image/')) {
        throw new Error(`Invalid content type: ${contentType}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      // Generate filename
      const extension = contentType.split('/')[1] || 'jpg';
      const fileName = `message-images/${messageId}-${Date.now()}.${extension}`;
      
      // Upload to Supabase Storage
      const { data, error } = await this.supabase.storage
        .from('message-attachments')
        .upload(fileName, buffer, {
          contentType: contentType,
          upsert: false
        });

      if (error) {
        console.error('Error uploading image to Supabase:', error);
        throw new Error(`Failed to upload image: ${error.message}`);
      }

      // Get permanent public URL
      const { data: urlData } = this.supabase.storage
        .from('message-attachments')
        .getPublicUrl(fileName);

      console.log(`Successfully stored image: ${imageUrl.substring(0, 50)}... -> ${urlData.publicUrl}`);
      
      return urlData.publicUrl;

    } catch (error) {
      console.error('Error processing image:', error);
      throw error;
    }
  }

  // Process message content and replace signed URLs with permanent ones
  async processMessageImages(content, messageId) {
    try {
      if (!content) return content;

      const imageUrls = this.extractImageUrls(content);
      const signedUrls = imageUrls.filter(url => this.isSignedUrl(url));

      if (signedUrls.length === 0) {
        console.log('No signed URLs found in message content');
        return content;
      }

      console.log(`Found ${signedUrls.length} signed URLs to process in message ${messageId}`);
      
      let processedContent = content;

      // Process each signed URL
      for (const signedUrl of signedUrls) {
        try {
          const permanentUrl = await this.downloadAndStoreImage(signedUrl, messageId);
          
          // Replace the signed URL with the permanent URL in the content
          processedContent = processedContent.replace(
            new RegExp(signedUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
            permanentUrl
          );
          
          console.log(`Replaced signed URL with permanent URL in message ${messageId}`);
          
        } catch (imageError) {
          console.error(`Failed to process image ${signedUrl}:`, imageError);
          // Continue processing other images even if one fails
        }
      }

      return processedContent;

    } catch (error) {
      console.error('Error processing message images:', error);
      // Return original content if processing fails
      return content;
    }
  }

  // Update existing message content with processed images
  async updateMessageContent(messageId, newContent) {
    try {
      const { error } = await this.supabase
        .from('messages')
        .update({
          content: newContent,
          updated_at: new Date().toISOString()
        })
        .eq('id', messageId);

      if (error) {
        console.error('Error updating message content:', error);
        throw error;
      }

      console.log(`Updated message ${messageId} with processed image URLs`);
      return { success: true };

    } catch (error) {
      console.error('Error updating message content:', error);
      throw error;
    }
  }
}

module.exports = new ImageProcessingService();
