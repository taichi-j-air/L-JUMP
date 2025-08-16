import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { supabase } from "@/integrations/supabase/client"
import { Image, Upload, X } from "lucide-react"
import { toast } from "sonner"

interface MediaFile {
  name: string
  publicUrl: string
  size: number
  created_at: string
}

interface MediaLibrarySelectorProps {
  trigger: React.ReactNode
  onSelect: (url: string) => void
  selectedUrl?: string
}

export function MediaLibrarySelector({ trigger, onSelect, selectedUrl }: MediaLibrarySelectorProps) {
  const [open, setOpen] = useState(false)
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (open) {
      loadMediaFiles()
    }
  }, [open])

  const loadMediaFiles = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.storage
        .from('media-files')
        .list('', {
          limit: 100,
          offset: 0,
          sortBy: { column: 'created_at', order: 'desc' }
        })

      if (error) throw error

      const files = await Promise.all(
        (data || []).map(async (file) => {
          const { data: urlData } = supabase.storage
            .from('media-files')
            .getPublicUrl(file.name)

          return {
            name: file.name,
            publicUrl: urlData.publicUrl,
            size: file.metadata?.size || 0,
            created_at: file.created_at || ''
          }
        })
      )

      setMediaFiles(files.filter(f => f.name.match(/\.(jpg|jpeg|png|gif|webp)$/i)))
    } catch (error: any) {
      console.error('メディアファイルの読み込みに失敗:', error)
      toast.error('メディアファイルの読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // ファイル形式チェック
    if (!file.type.startsWith('image/')) {
      toast.error('画像ファイルのみアップロード可能です')
      return
    }

    // ファイルサイズチェック（5MB）
    if (file.size > 5 * 1024 * 1024) {
      toast.error('ファイルサイズは5MB以下にしてください')
      return
    }

    setUploading(true)
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}.${fileExt}`

      const { error } = await supabase.storage
        .from('media-files')
        .upload(fileName, file)

      if (error) throw error

      toast.success('ファイルをアップロードしました')
      loadMediaFiles()
    } catch (error: any) {
      console.error('ファイルアップロードに失敗:', error)
      toast.error('ファイルアップロードに失敗しました')
    } finally {
      setUploading(false)
      // Reset input
      event.target.value = ''
    }
  }

  const handleSelect = (url: string) => {
    onSelect(url)
    setOpen(false)
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>メディアライブラリ</DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Upload Section */}
          <div className="border-b pb-4 mb-4">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                disabled={uploading}
                className="relative"
              >
                <Upload className="h-4 w-4 mr-2" />
                {uploading ? 'アップロード中...' : '画像をアップロード'}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  disabled={uploading}
                />
              </Button>
              <p className="text-sm text-muted-foreground">
                JPG, PNG, GIF, WebP形式（最大5MB）
              </p>
            </div>
          </div>

          {/* Selected Image */}
          {selectedUrl && (
            <div className="border-b pb-4 mb-4">
              <p className="text-sm font-medium mb-2">現在選択中:</p>
              <div className="flex items-center gap-4">
                <img 
                  src={selectedUrl} 
                  alt="Selected" 
                  className="h-16 w-16 object-cover rounded border"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSelect('')}
                >
                  <X className="h-4 w-4 mr-1" />
                  選択解除
                </Button>
              </div>
            </div>
          )}

          {/* Media Grid */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <p className="text-muted-foreground">読み込み中...</p>
              </div>
            ) : mediaFiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-center">
                <Image className="h-12 w-12 text-muted-foreground mb-2" />
                <p className="text-muted-foreground">メディアファイルがありません</p>
                <p className="text-sm text-muted-foreground">上記のボタンから画像をアップロードしてください</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {mediaFiles.map((file) => (
                  <Card 
                    key={file.name}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      selectedUrl === file.publicUrl ? 'ring-2 ring-primary' : ''
                    }`}
                    onClick={() => handleSelect(file.publicUrl)}
                  >
                    <CardContent className="p-2">
                      <div className="aspect-square mb-2">
                        <img
                          src={file.publicUrl}
                          alt={file.name}
                          className="w-full h-full object-cover rounded"
                        />
                      </div>
                      <div className="text-xs">
                        <p className="truncate font-medium">{file.name}</p>
                        <p className="text-muted-foreground">{formatFileSize(file.size)}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}