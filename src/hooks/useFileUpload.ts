import { useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

export interface UploadedFile {
  id: string
  name: string
  url: string
  size: number
  type: string
  uploadedAt: Date
  isShared?: boolean
}

export const SHARED_FILES: UploadedFile[] = [
  {
    id: 'shared/pngwin.png',
    name: 'pngwin.png',
    url: `${import.meta.env.BASE_URL ?? '/'}pngwin.png`,
    size: 160117,
    type: 'image/png',
    uploadedAt: new Date('2024-01-01T00:00:00Z'),
    isShared: true
  }
]

export const useFileUpload = () => {
  const [uploading, setUploading] = useState(false)
  const [files, setFiles] = useState<UploadedFile[]>([])

  const uploadFile = async (file: File): Promise<UploadedFile | null> => {
    try {
      setUploading(true)
      
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast.error('ログインが必要です')
        return null
      }

      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}/${Date.now()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('media-files')
        .upload(fileName, file)

      if (uploadError) {
        toast.error('アップロードに失敗しました: ' + uploadError.message)
        return null
      }

      const { data: { publicUrl } } = supabase.storage
        .from('media-files')
        .getPublicUrl(fileName)

      const uploadedFile: UploadedFile = {
        id: fileName,
        name: file.name,
        url: publicUrl,
        size: file.size,
        type: file.type,
        uploadedAt: new Date()
      }

      toast.success('ファイルのアップロードが完了しました')
      return uploadedFile
    } catch (error) {
      console.error('Upload error:', error)
      toast.error('アップロードに失敗しました')
      return null
    } finally {
      setUploading(false)
    }
  }

  const loadFiles = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase.storage
        .from('media-files')
        .list(user.id, {
          limit: 100,
          offset: 0,
          sortBy: { column: 'created_at', order: 'desc' }
        })

      if (error) {
        console.error('Error loading files:', error)
        return
      }

      const fileList: UploadedFile[] = data.map(file => {
        const { data: { publicUrl } } = supabase.storage
          .from('media-files')
          .getPublicUrl(`${user.id}/${file.name}`)

        return {
          id: `${user.id}/${file.name}`,
          name: file.name,
          url: publicUrl,
          size: file.metadata?.size || 0,
          type: file.metadata?.mimetype || '',
          uploadedAt: new Date(file.created_at)
        }
      })

      const combinedFiles = [
        ...SHARED_FILES,
        ...fileList.filter(
          file => !SHARED_FILES.some(shared => shared.url === file.url || shared.id === file.id)
        )
      ]

      setFiles(combinedFiles)
    } catch (error) {
      console.error('Error loading files:', error)
    }
  }

  const deleteFile = async (fileId: string) => {
    if (SHARED_FILES.some(file => file.id === fileId)) {
      toast.error('共有ファイルは削除できません')
      return false
    }

    try {
      const { error } = await supabase.storage
        .from('media-files')
        .remove([fileId])

      if (error) {
        toast.error('削除に失敗しました: ' + error.message)
        return false
      }

      setFiles(prev => prev.filter(file => file.id !== fileId))
      toast.success('ファイルを削除しました')
      return true
    } catch (error) {
      console.error('Delete error:', error)
      toast.error('削除に失敗しました')
      return false
    }
  }

  return {
    uploading,
    files,
    uploadFile,
    loadFiles,
    deleteFile
  }
}
