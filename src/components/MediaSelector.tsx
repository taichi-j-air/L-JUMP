import { useState, useEffect } from 'react'
import { ImageIcon, X } from 'lucide-react'
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

  const imageFiles = files.filter(file => file.type.startsWith('image/'))

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <ImageIcon className="h-4 w-4 mr-2" />
              画像を選択
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>画像を選択</DialogTitle>
            </DialogHeader>
            
            {imageFiles.length === 0 ? (
              <div className="text-center py-8">
                <ImageIcon className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">画像がありません</p>
                <p className="text-sm text-muted-foreground mt-1">
                  メディアライブラリで画像をアップロードしてください
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {imageFiles.map((file) => (
                  <Card
                    key={file.id}
                    className={`cursor-pointer hover:shadow-md transition-shadow ${
                      selectedUrl === file.url ? 'ring-2 ring-primary' : ''
                    }`}
                    onClick={() => handleSelect(file)}
                  >
                    <CardContent className="p-2">
                      <div className="aspect-square bg-muted rounded-lg overflow-hidden mb-2">
                        <img
                          src={file.url}
                          alt={file.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <p className="text-xs truncate" title={file.name}>
                        {file.name}
                      </p>
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
            <img
              src={selectedUrl}
              alt="Selected"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">選択された画像</p>
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