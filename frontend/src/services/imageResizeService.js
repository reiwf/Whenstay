/**
 * Image Resize Service
 * Handles client-side image resizing and compression to optimize storage usage
 */

export class ImageResizeService {
  constructor() {
    this.maxWidth = 1200;
    this.maxHeight = 1200;
    this.jpegQuality = 0.8;
    this.maxFileSizeKB = 500;
  }

  /**
   * Resize and compress an image file
   * @param {File} file - The image file to process
   * @param {Object} options - Optional resize parameters
   * @returns {Promise<File>} - Processed image file
   */
  async resizeImage(file, options = {}) {
    const {
      maxWidth = this.maxWidth,
      maxHeight = this.maxHeight,
      quality = this.jpegQuality,
      maxFileSizeKB = this.maxFileSizeKB
    } = options;

    return new Promise((resolve, reject) => {
      // Check if file is an image
      if (!file.type.startsWith('image/')) {
        reject(new Error('File is not an image'));
        return;
      }

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        try {
          // Calculate new dimensions
          const { width: newWidth, height: newHeight } = this.calculateDimensions(
            img.width, 
            img.height, 
            maxWidth, 
            maxHeight
          );

          // Set canvas dimensions
          canvas.width = newWidth;
          canvas.height = newHeight;

          // Draw and resize image
          ctx.drawImage(img, 0, 0, newWidth, newHeight);

          // Convert to blob with compression
          const outputFormat = this.shouldConvertToJPEG(file.type) ? 'image/jpeg' : file.type;
          
          canvas.toBlob((blob) => {
            if (!blob) {
              reject(new Error('Failed to process image'));
              return;
            }

            // Check file size and re-compress if needed
            const fileSizeKB = blob.size / 1024;
            
            if (fileSizeKB > maxFileSizeKB && outputFormat === 'image/jpeg') {
              // Re-compress with lower quality
              const newQuality = Math.max(0.5, quality * (maxFileSizeKB / fileSizeKB));
              canvas.toBlob((recompressedBlob) => {
                if (!recompressedBlob) {
                  reject(new Error('Failed to recompress image'));
                  return;
                }
                
                const processedFile = this.createFileFromBlob(recompressedBlob, file.name, outputFormat);
                resolve(processedFile);
              }, outputFormat, newQuality);
            } else {
              const processedFile = this.createFileFromBlob(blob, file.name, outputFormat);
              resolve(processedFile);
            }
          }, outputFormat, outputFormat === 'image/jpeg' ? quality : undefined);

        } catch (error) {
          reject(error);
        }
      };

      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };

      // Create object URL and load image
      const objectUrl = URL.createObjectURL(file);
      img.src = objectUrl;
      
      // Clean up object URL after loading
      img.onload = (originalOnLoad => {
        return function(...args) {
          URL.revokeObjectURL(objectUrl);
          return originalOnLoad.apply(this, args);
        };
      })(img.onload);
    });
  }

  /**
   * Process multiple image files
   * @param {FileList|File[]} files - Array of image files
   * @param {Function} progressCallback - Progress callback (current, total)
   * @param {Object} options - Resize options
   * @returns {Promise<File[]>} - Array of processed files
   */
  async resizeMultipleImages(files, progressCallback = null, options = {}) {
    const fileArray = Array.from(files);
    const results = [];
    
    for (let i = 0; i < fileArray.length; i++) {
      try {
        if (progressCallback) {
          progressCallback(i, fileArray.length);
        }
        
        const processedFile = await this.resizeImage(fileArray[i], options);
        results.push(processedFile);
      } catch (error) {
        console.error(`Failed to process image ${fileArray[i].name}:`, error);
        // Include the original file if processing fails
        results.push(fileArray[i]);
      }
    }
    
    if (progressCallback) {
      progressCallback(fileArray.length, fileArray.length);
    }
    
    return results;
  }

  /**
   * Calculate new dimensions while maintaining aspect ratio
   * @param {number} width - Original width
   * @param {number} height - Original height  
   * @param {number} maxWidth - Maximum width
   * @param {number} maxHeight - Maximum height
   * @returns {Object} - New dimensions {width, height}
   */
  calculateDimensions(width, height, maxWidth, maxHeight) {
    // If image is already smaller than max dimensions, keep original size
    if (width <= maxWidth && height <= maxHeight) {
      return { width, height };
    }

    // Calculate scaling ratio
    const widthRatio = maxWidth / width;
    const heightRatio = maxHeight / height;
    const ratio = Math.min(widthRatio, heightRatio);

    return {
      width: Math.round(width * ratio),
      height: Math.round(height * ratio)
    };
  }

  /**
   * Check if file type should be converted to JPEG for better compression
   * @param {string} mimeType - Original MIME type
   * @returns {boolean} - Should convert to JPEG
   */
  shouldConvertToJPEG(mimeType) {
    // Convert PNG to JPEG for better compression (except if it might have transparency)
    // Keep WebP as-is since it's already efficient
    // Convert other formats to JPEG
    const keepAsIs = ['image/jpeg', 'image/webp'];
    return !keepAsIs.includes(mimeType);
  }

  /**
   * Create a File object from a blob
   * @param {Blob} blob - Image blob
   * @param {string} originalName - Original filename
   * @param {string} mimeType - Output MIME type
   * @returns {File} - File object
   */
  createFileFromBlob(blob, originalName, mimeType) {
    const extension = mimeType.split('/')[1];
    const nameWithoutExt = originalName.replace(/\.[^/.]+$/, '');
    const newName = `${nameWithoutExt}_resized.${extension}`;
    
    return new File([blob], newName, { 
      type: mimeType,
      lastModified: Date.now()
    });
  }

  /**
   * Get image file info including dimensions
   * @param {File} file - Image file
   * @returns {Promise<Object>} - Image info
   */
  async getImageInfo(file) {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) {
        reject(new Error('File is not an image'));
        return;
      }

      const img = new Image();
      const objectUrl = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        resolve({
          width: img.width,
          height: img.height,
          size: file.size,
          sizeKB: Math.round(file.size / 1024),
          type: file.type,
          name: file.name
        });
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Failed to load image'));
      };

      img.src = objectUrl;
    });
  }

  /**
   * Validate if files are images and within size limits
   * @param {FileList|File[]} files - Files to validate
   * @param {Object} options - Validation options
   * @returns {Object} - Validation result
   */
  validateImages(files, options = {}) {
    const {
      maxFiles = 5,
      maxFileSizeMB = 10,
      allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    } = options;

    const fileArray = Array.from(files);
    const errors = [];
    const validFiles = [];

    if (fileArray.length > maxFiles) {
      errors.push(`Maximum ${maxFiles} images allowed`);
    }

    fileArray.forEach((file, index) => {
      if (!file.type.startsWith('image/')) {
        errors.push(`File ${file.name} is not an image`);
      } else if (!allowedTypes.includes(file.type)) {
        errors.push(`File ${file.name} has unsupported format`);
      } else if (file.size > maxFileSizeMB * 1024 * 1024) {
        errors.push(`File ${file.name} is too large (max ${maxFileSizeMB}MB)`);
      } else {
        validFiles.push(file);
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      validFiles,
      totalFiles: fileArray.length,
      validCount: validFiles.length
    };
  }
}

// Create and export singleton instance
export const imageResizeService = new ImageResizeService();

export default imageResizeService;
