import { useState, useRef } from 'react'
import { Upload, X, FileImage, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { uploadFile } from '../services/fileUpload'

export default function FileUpload({ 
  onFileUpload,
  onFileSelect, // Keep for backward compatibility
  onError,
  accept = 'image/*', 
  maxSize = 5 * 1024 * 1024, // 5MB default
  className = '',
  bucketName = 'guest-documents',
  folder = ''
}) {
  const [selectedFile, setSelectedFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef(null)

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

  const removeFile = () => {
    setSelectedFile(null)
    setPreview(null)
    
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

  if (selectedFile) {
    return (
      <div className={`border border-gray-300 rounded-lg p-4 ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {preview ? (
              <img 
                src={preview} 
                alt="Preview" 
                className="w-12 h-12 object-cover rounded"
              />
            ) : (
              <FileImage className="w-12 h-12 text-gray-400" />
            )}
            <div>
              <p className="text-sm font-medium text-gray-900">
                {selectedFile.name}
              </p>
              <p className="text-xs text-gray-500">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={removeFile}
            className="p-1 text-gray-400 hover:text-red-500 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    )
  }

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




