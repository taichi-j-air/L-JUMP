import { useEffect, useMemo, useState } from "react"

export type FolderColor = 'primary' | 'secondary' | 'accent' | 'destructive' | 'muted'

export interface ScenarioFolder {
  id: string
  name: string
  color: FolderColor
  collapsed: boolean
  scenarioIds: string[]
}

const uid = () => crypto.randomUUID()

export function useScenarioFolders(userId?: string) {
  const storageKey = useMemo(() => userId ? `scenarioFolders:${userId}` : undefined, [userId])
  const [folders, setFolders] = useState<ScenarioFolder[]>([])

  // Load/save from localStorage
  useEffect(() => {
    if (!storageKey) return
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) setFolders(JSON.parse(raw))
    } catch {}
  }, [storageKey])

  useEffect(() => {
    if (!storageKey) return
    try {
      localStorage.setItem(storageKey, JSON.stringify(folders))
    } catch {}
  }, [folders, storageKey])

  const addFolder = (name = '新しいフォルダ', color: FolderColor = 'accent') => {
    setFolders(prev => [...prev, { id: uid(), name, color, collapsed: false, scenarioIds: [] }])
  }

  const renameFolder = (id: string, name: string) => {
    setFolders(prev => prev.map(f => f.id === id ? { ...f, name } : f))
  }

  const setFolderColor = (id: string, color: FolderColor) => {
    setFolders(prev => prev.map(f => f.id === id ? { ...f, color } : f))
  }

  const toggleFolder = (id: string) => {
    setFolders(prev => prev.map(f => f.id === id ? { ...f, collapsed: !f.collapsed } : f))
  }

  const getFolderIdByScenario = (scenarioId: string) => {
    return folders.find(f => f.scenarioIds.includes(scenarioId))?.id || null
  }

  const moveToFolder = (scenarioId: string, toFolderId: string) => {
    setFolders(prev => {
      // remove from any folder
      let removed = prev.map(f => ({ ...f, scenarioIds: f.scenarioIds.filter(id => id !== scenarioId) }))
      // add to target
      return removed.map(f => f.id === toFolderId ? { ...f, scenarioIds: [...f.scenarioIds, scenarioId] } : f)
    })
  }

  const removeFromFolder = (scenarioId: string) => {
    setFolders(prev => prev.map(f => ({ ...f, scenarioIds: f.scenarioIds.filter(id => id !== scenarioId) })))
  }

  const deleteFolder = (id: string) => {
    setFolders(prev => prev.filter(f => f.id !== id))
  }

  const reorderFolders = (orderedIds: string[]) => {
    setFolders(prev => orderedIds
      .map(id => prev.find(f => f.id === id))
      .filter((f): f is ScenarioFolder => Boolean(f))
    )
  }

  return {
    folders,
    addFolder,
    renameFolder,
    setFolderColor,
    toggleFolder,
    moveToFolder,
    removeFromFolder,
    deleteFolder,
    reorderFolders,
    getFolderIdByScenario,
  }
}
