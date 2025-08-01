import { useState, useRef, useEffect } from 'react'
import { Upload, X, FileImage, Loader2, Trash2, Camera } from 'lucide-react'
import toast from 'react-hot-toast'
import { uploadFile } from '../services/fileUpload'

export default function FileUpload({ 
  onFileUpload,
  onFileSelect, // Keep for backward compatibility
  onError,
  onDeleteExisting, // Callback when deleting existing image
  initialImageUrl = null, // URL of existing image from database
  accept = 'image/*', 
  maxSize = 5 * 1024 * 1024, // 5MB default
  className = '',
  bucketName = 'guest-documents',
  folder = '',
  showFileName = false // Whether to show filename for existing images
}) {
  const [selectedFile, setSelectedFile] = useState(null)
  const [preview, setPreview] = useState(initialImageUrl)
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [hasExistingImage, setHasExistingImage] = useState(!!initialImageUrl)
  const fileInputRef = useRef(null)

  // Update preview when initialImageUrl changes
  useEffect(() => {
    if (initialImageUrl && !selectedFile) {
      setPreview(initialImageUrl)
      setHasExistingImage(true)
    }
  }, [initialImageUrl, selectedFile])

  const validateFile = (file) => {
    if (!file) return false

    // Check file type
    if (accept && !file.type.match(accept.replace('*', '.*'))) {
      toast.error('Invalid file type. Please select an image file.')
      return false
    }

    // Check file size
    if (file.size > maxSize) {
      const maxSizeMB = Math.round(maxSize / (1024 * 1024))
      toast.error(`File size too large. Maximum size is ${maxSizeMB}MB.`)
      return false
    }

    return true
  }

  const handleFileSelect = async (file) => {
    if (!validateFile(file)) return

    setSelectedFile(file)
    setUploading(true)

    // Create preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (e) => setPreview(e.target.result)
      reader.readAsDataURL(file)
    }

    // Call legacy onFileSelect if provided (for backward compatibility)
    if (onFileSelect) {
      onFileSelect(file)
    }

    // Upload file if onFileUpload is provided
    if (onFileUpload) {
      try {
        const result = await uploadFile(file, bucketName, folder)
        
        if (result.success) {
          toast.success('File uploaded successfully!')
          onFileUpload(file, result.publicUrl, result.filePath)
        } else {
          throw new Error(result.error)
        }
      } catch (error) {
        console.error('Upload error:', error)
        const errorMessage = error.message || 'Failed to upload file'
        toast.error(errorMessage)
        
        if (onError) {
          onError(errorMessage)
        }
        
        // Reset file selection on error
        setSelectedFile(null)
        setPreview(null)
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      } finally {
        setUploading(false)
      }
    } else {
      setUploading(false)
    }
  }

  const handleFileInputChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    
    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFileSelect(files[0])
    }
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    setDragOver(false)
  }

  const handleDeleteExisting = async () => {
    if (deleting) return
    
    setDeleting(true)
    try {
      if (onDeleteExisting) {
        await onDeleteExisting()
      }
      
      // Reset state
      setPreview(null)
      setHasExistingImage(false)
      setSelectedFile(null)
      
      // Notify parent components
      if (onFileSelect) {
        onFileSelect(null)
      }
      if (onFileUpload) {
        onFileUpload(null, null, null)
      }
      
      toast.success('Image deleted successfully!')
    } catch (error) {
      console.error('Delete error:', error)
      toast.error('Failed to delete image')
    } finally {
      setDeleting(false)
    }
  }

  const removeFile = () => {
    setSelectedFile(null)
    setPreview(hasExistingImage ? initialImageUrl : null)
    
    // Call callbacks to notify parent components
    if (onFileSelect) {
      onFileSelect(null)
    }
    if (onFileUpload) {
      onFileUpload(null, null, null)
    }
    
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const openFileDialog = () => {
    fileInputRef.current?.click()
  }

  // Show image preview (either existing or newly selected)
  if (preview) {
    return (
      <div className={`space-y-4 ${className}`}>
        {/* Large Image Preview */}
        <div className="relative group">
          <div className="relative overflow-hidden rounded-lg border-2 border-gray-200 bg-gray-50">
            <img 
              src={preview} 
              alt="Document preview" 
              className="w-full h-48 sm:h-64 object-cover"
            />
            
            {/* Delete Button Overlay */}
            <div className="absolute top-2 right-2 flex gap-2">
              {hasExistingImage && !selectedFile && (
                <button
                  type="button"
                  onClick={handleDeleteExisting}
                  disabled={deleting}
                  className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-lg transition-colors disabled:opacity-50"
                  title="Delete image"
                >
                  {deleting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              )}
              
              {selectedFile && (
                <button
                  type="button"
                  onClick={removeFile}
                  className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-lg transition-colors"
                  title="Remove selected file"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Upload Progress Overlay */}
            {uploading && (
              <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                <div className="text-center text-white">
                  <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin" />
                  <p className="text-sm">Uploading...</p>
                </div>
              </div>
            )}
          </div>

          {/* File Info */}
          {selectedFile && showFileName && (
            <div className="mt-2 p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {selectedFile.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Change Image Button */}
        <div className="text-center">
          <button
            type="button"
            onClick={openFileDialog}
            disabled={uploading || deleting}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
          >
            <Camera className="w-4 h-4 mr-2" />
            {hasExistingImage && !selectedFile ? 'Change Image' : 'Replace Image'}
          </button>
        </div>
      </div>
    )
  }

  // Show upload area when no image is present
  return (
    <div className={className}>
      <div
        className={`file-upload-area ${dragOver ? 'dragover' : ''} ${uploading ? 'uploading' : ''}`}
        onDrop={uploading ? undefined : handleDrop}
        onDragOver={uploading ? undefined : handleDragOver}
        onDragLeave={uploading ? undefined : handleDragLeave}
        onClick={uploading ? undefined : openFileDialog}
      >
        {uploading ? (
          <>
            <Loader2 className="w-8 h-8 text-primary-600 mx-auto mb-2 animate-spin" />
            <p className="text-sm text-primary-600 mb-1">
              Uploading your document...
            </p>
            <p className="text-xs text-gray-500">
              Please wait while we securely upload your file
            </p>
          </>
        ) : (
          <>
            <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-600 mb-1">
              <span className="font-medium text-primary-600 cursor-pointer">
                Click to upload
              </span> or drag and drop
            </p>
            <p className="text-xs text-gray-500">
              {accept.includes('image') ? 'PNG, JPG, JPEG' : 'Supported files'} up to {Math.round(maxSize / (1024 * 1024))}MB
            </p>
          </>
        )}
      </div>
      
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileInputChange}
        className="hidden"
        disabled={uploading}
      />
    </div>
  )
}
