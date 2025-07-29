import { useEffect, useState } from 'react'
import { Copy, Download, Eye, Trash2, FileIcon, ImageIcon, VideoIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { FileUploader } from '@/components/FileUploader'
import { useFileUpload, UploadedFile } from '@/hooks/useFileUpload'
import { toast } from 'sonner'

export default function MediaLibrary() {
  const { files, loadFiles, deleteFile } = useFileUpload()
  const [selectedFile, setSelectedFile] = useState<UploadedFile | null>(null)

  useEffect(() => {
    loadFiles()
  }, [loadFiles])

  const handleFileUploaded = (file: UploadedFile) => {
    loadFiles() // Refresh the file list
  }

  const copyToClipboard = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      toast.success('URLをクリップボードにコピーしました')
    } catch (error) {
      toast.error('URLのコピーに失敗しました')
    }
  }

  const downloadFile = (url: string, name: string) => {
    const link = document.createElement('a')
    link.href = url
    link.download = name
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <ImageIcon className="h-6 w-6" />
    if (type.startsWith('video/')) return <VideoIcon className="h-6 w-6" />
    return <FileIcon className="h-6 w-6" />
  }

  const getFileTypeLabel = (type: string) => {
    if (type.startsWith('image/')) return '画像'
    if (type.startsWith('video/')) return '動画'
    if (type === 'application/pdf') return 'PDF'
    return 'ファイル'
  }

  const isImageFile = (type: string) => type.startsWith('image/')
  const isVideoFile = (type: string) => type.startsWith('video/')

  return (
    <div className="container mx-auto py-8 px-4 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">メディアライブラリ</h1>
          <p className="text-muted-foreground mt-2">
            画像、動画、その他のファイルを管理します
          </p>
        </div>
        <Badge variant="secondary" className="text-sm">
          {files.length} ファイル
        </Badge>
      </div>

      <FileUploader onFileUploaded={handleFileUploaded} />

      {files.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <FileIcon className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">ファイルがありません</h3>
            <p className="text-muted-foreground">
              上記のアップローダーを使用してファイルを追加してください
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {files.map((file) => (
            <Card key={file.id} className="overflow-hidden hover:shadow-md transition-shadow">
              <CardHeader className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getFileIcon(file.type)}
                    <Badge variant="outline" className="text-xs">
                      {getFileTypeLabel(file.type)}
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteFile(file.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              
              <CardContent className="p-4 pt-0">
                {isImageFile(file.type) && (
                  <div className="aspect-video bg-muted rounded-lg mb-3 overflow-hidden">
                    <img
                      src={file.url}
                      alt={file.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                
                {isVideoFile(file.type) && (
                  <div className="aspect-video bg-muted rounded-lg mb-3 overflow-hidden">
                    <video
                      src={file.url}
                      className="w-full h-full object-cover"
                      controls
                      preload="metadata"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <h4 className="font-medium text-sm truncate" title={file.name}>
                    {file.name}
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(file.size)} • {file.uploadedAt.toLocaleDateString('ja-JP')}
                  </p>
                  
                  <div className="flex gap-1">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="flex-1">
                          <Eye className="h-4 w-4 mr-1" />
                          プレビュー
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl">
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <h3 className="text-lg font-medium">{file.name}</h3>
                            <Badge>{getFileTypeLabel(file.type)}</Badge>
                          </div>
                          
                          {isImageFile(file.type) && (
                            <img
                              src={file.url}
                              alt={file.name}
                              className="w-full max-h-96 object-contain rounded-lg"
                            />
                          )}
                          
                          {isVideoFile(file.type) && (
                            <video
                              src={file.url}
                              className="w-full max-h-96 rounded-lg"
                              controls
                            />
                          )}
                          
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              onClick={() => copyToClipboard(file.url)}
                              className="flex-1"
                            >
                              <Copy className="h-4 w-4 mr-2" />
                              URLをコピー
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => downloadFile(file.url, file.name)}
                              className="flex-1"
                            >
                              <Download className="h-4 w-4 mr-2" />
                              ダウンロード
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(file.url)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}