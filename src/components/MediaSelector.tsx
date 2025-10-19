import { useState, useEffect } from 'react'
import { FileIcon, X, Image, Video, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useFileUpload, UploadedFile } from '@/hooks/useFileUpload'

interface MediaSelectorProps {
  onSelect: (fileUrl: string) => void
  selectedUrl?: string
}

export const MediaSelector = ({ onSelect, selectedUrl }: MediaSelectorProps) => {
  const { files, loadFiles } = useFileUpload()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (open) {
      loadFiles()
    }
  }, [open, loadFiles])

  const handleSelect = (file: UploadedFile) => {
    onSelect(file.url)
    setOpen(false)
  }

  const clearSelection = () => {
    onSelect('')
  }

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <Image className="h-4 w-4" />
    if (type.startsWith('video/')) return <Video className="h-4 w-4" />
    return <FileText className="h-4 w-4" />
  }

  const getFilePreview = (file: UploadedFile) => {
    if (file.type.startsWith('image/')) {
      return (
        <img
          src={file.url}
          alt={file.name}
          className="max-h-full max-w-full object-contain"
        />
      )
    }
    if (file.type.startsWith('video/')) {
      return (
        <video
          src={file.url}
          className="max-h-full max-w-full object-contain"
          muted
        />
      )
    }
    return (
      <FileIcon className="h-8 w-8 text-muted-foreground" />
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <FileIcon className="h-4 w-4 mr-2" />
              メディアを選択
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>メディアファイルを選択</DialogTitle>
            </DialogHeader>
            
            {files.length === 0 ? (
              <div className="text-center py-8">
                <FileIcon className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">メディアファイルがありません</p>
                <p className="text-sm text-muted-foreground mt-1">
                  メディアライブラリでファイルをアップロードしてください
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {files.map((file) => (
                  <Card
                    key={file.id}
                    className={`cursor-pointer hover:shadow-md transition-shadow ${
                      selectedUrl === file.url ? 'ring-2 ring-primary' : ''
                    }`}
                    onClick={() => handleSelect(file)}
                  >
                  <CardContent className="p-2">
                    <div className="h-28 bg-muted/60 rounded-md overflow-hidden flex items-center justify-center mb-2">
                      {getFilePreview(file)}
                    </div>
                      <div className="flex items-center gap-1">
                        {getFileIcon(file.type)}
                        <p className="text-xs truncate flex-1" title={file.name}>
                          {file.name}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {selectedUrl && (
          <Button variant="outline" size="sm" onClick={clearSelection}>
            <X className="h-4 w-4 mr-1" />
            クリア
          </Button>
        )}
      </div>

      {selectedUrl && (
        <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
          <div className="w-12 h-12 bg-background rounded overflow-hidden flex-shrink-0">
            {selectedUrl.includes('image') ? (
              <img
                src={selectedUrl}
                alt="Selected"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <FileIcon className="h-6 w-6 text-muted-foreground" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">選択されたファイル</p>
            <p className="text-xs text-muted-foreground truncate">
              {selectedUrl}
            </p>
          </div>
          <Badge variant="secondary">選択中</Badge>
        </div>
      )}
    </div>
  )
}
