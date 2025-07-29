import { useCallback, useState } from 'react'
import { Upload, X, FileIcon, ImageIcon, VideoIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { useFileUpload, UploadedFile } from '@/hooks/useFileUpload'
import { toast } from 'sonner'

interface FileUploaderProps {
  onFileUploaded?: (file: UploadedFile) => void
  acceptedTypes?: string[]
  maxSize?: number // in bytes
}

export const FileUploader = ({ 
  onFileUploaded, 
  acceptedTypes = ['image/*', 'video/*', 'application/pdf'],
  maxSize = 50 * 1024 * 1024 // 50MB
}: FileUploaderProps) => {
  const [dragActive, setDragActive] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const { uploading, uploadFile } = useFileUpload()

  const handleFiles = useCallback(async (files: FileList) => {
    const file = files[0]
    if (!file) return

    // Check file size
    if (file.size > maxSize) {
      toast.error(`ファイルサイズが大きすぎます（最大: ${maxSize / 1024 / 1024}MB）`)
      return
    }

    // Check file type
    const isValidType = acceptedTypes.some(type => {
      if (type.endsWith('/*')) {
        return file.type.startsWith(type.replace('/*', '/'))
      }
      return file.type === type
    })

    if (!isValidType) {
      toast.error('サポートされていないファイル形式です')
      return
    }

    setUploadProgress(0)
    const uploadedFile = await uploadFile(file)
    
    if (uploadedFile && onFileUploaded) {
      onFileUploaded(uploadedFile)
    }
    setUploadProgress(0)
  }, [uploadFile, onFileUploaded, acceptedTypes, maxSize])

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files)
    }
  }, [handleFiles])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault()
    if (e.target.files && e.target.files[0]) {
      handleFiles(e.target.files)
    }
  }, [handleFiles])

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <ImageIcon className="h-8 w-8" />
    if (type.startsWith('video/')) return <VideoIcon className="h-8 w-8" />
    return <FileIcon className="h-8 w-8" />
  }

  return (
    <Card className="w-full">
      <CardContent className="p-6">
        <div
          className={`
            relative border-2 border-dashed rounded-lg p-8 text-center transition-colors
            ${dragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'}
            ${uploading ? 'pointer-events-none opacity-50' : 'hover:border-primary hover:bg-primary/5'}
          `}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            type="file"
            accept={acceptedTypes.join(',')}
            onChange={handleInputChange}
            disabled={uploading}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          
          <div className="flex flex-col items-center gap-4">
            <Upload className="h-12 w-12 text-muted-foreground" />
            <div>
              <p className="text-lg font-medium">
                ファイルをドラッグ&ドロップまたはクリックしてアップロード
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {acceptedTypes.includes('image/*') && '画像、'}
                {acceptedTypes.includes('video/*') && '動画、'}
                {acceptedTypes.includes('application/pdf') && 'PDF'}
                ファイル（最大{maxSize / 1024 / 1024}MB）
              </p>
            </div>
            
            {!uploading && (
              <Button variant="outline" size="sm">
                ファイルを選択
              </Button>
            )}
          </div>

          {uploading && (
            <div className="mt-4">
              <Progress value={uploadProgress || 50} className="w-full" />
              <p className="text-sm text-muted-foreground mt-2">アップロード中...</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}