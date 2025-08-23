import { useState, useRef, useEffect } from 'react'
import { Upload, X, Loader2, Trash2, Camera } from 'lucide-react'
import toast from 'react-hot-toast'
import { uploadFile, deleteFile } from '../services/fileUpload'

export default function FileUpload({
  onFileUpload,
  onFileSelect,              // backward compatible
  onError,
  onDeleteExisting,
  initialImageUrl = null,
  initialFilePath = null,    // File path for existing images
  accept = 'image/*',
  maxSize = 5 * 1024 * 1024,
  className = '',
  bucketName = 'guest-documents',
  folder = '',
  showFileName = false,
  disabled = false
}) {
  const [selectedFile, setSelectedFile] = useState(null)
  const [preview, setPreview] = useState(initialImageUrl)
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [hasExistingImage, setHasExistingImage] = useState(!!initialImageUrl)
  const [currentFilePath, setCurrentFilePath] = useState(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (initialImageUrl && !selectedFile) {
      setPreview(initialImageUrl)
      setHasExistingImage(true)
    }
  }, [initialImageUrl, selectedFile])

  const validateFile = (file) => {
    if (!file) return false
    if (accept && !file.type.match(accept.replace('*', '.*'))) {
      toast.error('Invalid file type. Please select a supported file.')
      return false
    }
    if (file.size > maxSize) {
      const maxSizeMB = Math.round(maxSize / (1024 * 1024))
      toast.error(`File too large. Max ${maxSizeMB}MB.`)
      return false
    }
    return true
  }

  const handleFileSelect = async (file) => {
    if (disabled || !validateFile(file)) return

    setSelectedFile(file)
    setUploading(true)

    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (e) => setPreview(e.target.result)
      reader.readAsDataURL(file)
    }

    onFileSelect?.(file)

    if (onFileUpload) {
      try {
        const result = await uploadFile(file, bucketName, folder)
        if (!result?.success) throw new Error(result?.error || 'Failed to upload file')
        setCurrentFilePath(result.filePath)
        toast.success('Uploaded!')
        onFileUpload(file, result.publicUrl, result.filePath)
      } catch (err) {
        const msg = err?.message || 'Upload failed'
        toast.error(msg)
        onError?.(msg)
        setSelectedFile(null)
        setPreview(null)
        if (fileInputRef.current) fileInputRef.current.value = ''
      } finally {
        setUploading(false)
      }
    } else {
      setUploading(false)
    }
  }

  const handleFileInputChange = (e) => {
    const file = e.target.files?.[0]
    if (file) handleFileSelect(file)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const files = e.dataTransfer.files
    if (files.length > 0) handleFileSelect(files[0])
  }

  const openFileDialog = () => fileInputRef.current?.click()

  const handleDeleteExisting = async () => {
    if (deleting) return
    setDeleting(true)
    try {
      // If we have the file path for the existing image, delete it from storage
      if (initialFilePath) {
        const result = await deleteFile(initialFilePath, bucketName)
        if (!result.success) {
          console.error('Failed to delete existing file from storage:', result.error)
          toast.error('Failed to remove from storage')
          return
        }
      }
      
      // Call the callback for any additional cleanup
      await onDeleteExisting?.()
      
      setPreview(null)
      setHasExistingImage(false)
      setSelectedFile(null)
      setCurrentFilePath(null)
      onFileSelect?.(null)
      onFileUpload?.(null, null, null)
      toast.success('Deleted from storage.')
    } catch (error) {
      console.error('Error deleting existing file:', error)
      toast.error('Failed to delete')
    } finally {
      setDeleting(false)
    }
  }

  const removeSelectedFile = async () => {
    // If we have a newly uploaded file with a file path, delete it from storage
    if (currentFilePath && selectedFile) {
      setDeleting(true)
      try {
        const result = await deleteFile(currentFilePath, bucketName)
        if (result.success) {
          toast.success('File removed from storage')
        } else {
          console.error('Failed to delete from storage:', result.error)
          toast.error('Failed to remove from storage')
        }
      } catch (error) {
        console.error('Error deleting file:', error)
        toast.error('Failed to remove from storage')
      } finally {
        setDeleting(false)
      }
    }

    // Reset component state
    setSelectedFile(null)
    setCurrentFilePath(null)
    setPreview(hasExistingImage ? initialImageUrl : null)
    onFileSelect?.(null)
    onFileUpload?.(null, null, null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ---------- Preview Mode ----------
  if (preview) {
    return (
      <div className={className}>
        <div className="relative rounded-2xl overflow-hidden bg-white/70 ring-1 ring-slate-200 shadow-sm">
          <img
            src={preview}
            alt="Document preview"
            className="w-full max-h-[26rem] object-cover"
          />

          {/* top-right actions */}
          {!disabled && (
            <div className="absolute top-2 right-2 flex gap-2">
              {hasExistingImage && !selectedFile && (
                <button
                  type="button"
                  onClick={handleDeleteExisting}
                  disabled={deleting}
                  className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-white/90 ring-1 ring-slate-200 text-slate-700 hover:bg-white disabled:opacity-50"
                  title="Delete image"
                >
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                </button>
              )}
              {selectedFile && (
                <button
                  type="button"
                  onClick={removeSelectedFile}
                  disabled={deleting}
                  className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-white/90 ring-1 ring-slate-200 text-slate-700 hover:bg-white disabled:opacity-50"
                  title="Remove selected file"
                >
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                </button>
              )}
            </div>
          )}

          {/* uploading overlay */}
          {uploading && (
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center">
              <div className="text-center text-white">
                <Loader2 className="w-7 h-7 mx-auto mb-2 animate-spin" />
                <p className="text-sm">Uploading…</p>
              </div>
            </div>
          )}
        </div>

        {/* filename chip */}
        {selectedFile && showFileName && (
          <div className="mt-2 px-3 py-2 rounded-xl bg-white/70 ring-1 ring-slate-200">
            <div className="text-sm font-medium text-slate-900 truncate">{selectedFile.name}</div>
            <div className="text-xs text-slate-600">
              {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
            </div>
          </div>
        )}

        {/* replace button */}
        {!disabled && (
          <div className="mt-3 text-center">
            <button
              type="button"
              onClick={openFileDialog}
              disabled={uploading || deleting}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-slate-900 text-white
                         hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900
                         disabled:opacity-50"
            >
              <Camera className="w-4 h-4" />
              {hasExistingImage && !selectedFile ? 'Change image' : 'Replace image'}
            </button>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          onChange={handleFileInputChange}
          className="hidden"
          disabled={uploading || disabled}
        />
      </div>
    )
  }

  // ---------- Dropzone Mode ----------
  const isImages = accept.includes('image')
  const maxMB = Math.round(maxSize / (1024 * 1024))

  return (
    <div className={className}>
      <div
        role="button"
        tabIndex={0}
        onClick={uploading || disabled ? undefined : openFileDialog}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !uploading && !disabled) openFileDialog()
        }}
        onDrop={uploading || disabled ? undefined : handleDrop}
        onDragOver={uploading || disabled ? undefined : (e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={uploading || disabled ? undefined : (e) => { e.preventDefault(); setDragOver(false) }}
        className={[
          'rounded-2xl p-5 text-center cursor-pointer select-none',
          'bg-white/70 ring-1 ring-slate-200 shadow-sm',
          dragOver ? 'ring-2 ring-slate-400 bg-white/90' : '',
          uploading ? 'opacity-70 pointer-events-none' : '',
          disabled ? 'opacity-60 cursor-not-allowed' : ''
        ].join(' ')}
        aria-disabled={disabled}
      >
        {uploading ? (
          <>
            <Loader2 className="w-8 h-8 text-slate-900 mx-auto mb-2 animate-spin" />
            <p className="text-sm text-slate-800 mb-0.5">Uploading…</p>
            <p className="text-xs text-slate-500">Please wait while we securely upload your file</p>
          </>
        ) : (
          <>
            <div className="mx-auto mb-2 inline-flex items-center justify-center w-10 h-10 rounded-full bg-slate-100">
              <Upload className="w-5 h-5 text-slate-500" />
            </div>
            <p className="text-sm text-slate-700">
              <span className="font-medium text-slate-900">Tap to upload</span> or drag & drop
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {isImages ? 'PNG, JPG' : 'Supported files'} • up to {maxMB}MB
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
        disabled={uploading || disabled}
      />
    </div>
  )
}
