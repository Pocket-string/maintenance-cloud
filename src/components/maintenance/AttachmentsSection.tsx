'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { getAttachmentsForRecord, uploadAttachment, deleteAttachment } from '@/actions/attachments'
import type { AttachmentWithUrl } from '@/actions/attachments'
import type { AttachmentCategory } from '@/types/database'

interface Props {
  recordId: string
  readOnly?: boolean
}

// ------------------------------------------------------------------
// Camera Modal (WebRTC for desktop, falls back to file input on mobile)
// ------------------------------------------------------------------

function CameraModal({ onCapture, onClose }: { onCapture: (file: File) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' } })
      .then(stream => {
        if (!mounted) {
          stream.getTracks().forEach(t => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
      })
      .catch(() => {
        if (mounted) setCameraError('No se pudo acceder a la camara. Verifica los permisos del navegador.')
      })

    return () => {
      mounted = false
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [])

  function handleCapture() {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.drawImage(video, 0, 0)
    canvas.toBlob(blob => {
      if (!blob) return
      const file = new File([blob], `foto-${Date.now()}.jpg`, { type: 'image/jpeg' })
      streamRef.current?.getTracks().forEach(t => t.stop())
      onCapture(file)
    }, 'image/jpeg', 0.85)
  }

  function handleClose() {
    streamRef.current?.getTracks().forEach(t => t.stop())
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-neu-bg shadow-neu-lg rounded-2xl max-w-lg w-full mx-4 overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-foreground">Tomar Foto</h3>
          <button onClick={handleClose} className="text-foreground-secondary hover:text-foreground text-xl leading-none">&times;</button>
        </div>
        <div className="p-4">
          {cameraError ? (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              {cameraError}
            </div>
          ) : (
            <>
              <video ref={videoRef} autoPlay playsInline muted className="w-full rounded-xl bg-black aspect-video object-cover" />
              <canvas ref={canvasRef} className="hidden" />
            </>
          )}
        </div>
        <div className="p-4 border-t border-border flex justify-end gap-3">
          <Button variant="ghost" onClick={handleClose}>Cancelar</Button>
          {!cameraError && (
            <Button onClick={handleCapture}>Capturar</Button>
          )}
        </div>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------
// Image Lightbox
// ------------------------------------------------------------------

function ImageLightbox({
  src,
  fileName,
  onClose,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}: {
  src: string
  fileName: string
  onClose: () => void
  onPrev: () => void
  onNext: () => void
  hasPrev: boolean
  hasNext: boolean
}) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft' && hasPrev) onPrev()
      if (e.key === 'ArrowRight' && hasNext) onNext()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose, onPrev, onNext, hasPrev, hasNext])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={onClose}>
      <div className="relative max-w-[90vw] max-h-[90vh]" onClick={e => e.stopPropagation()}>
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 text-white/80 hover:text-white text-2xl leading-none"
          aria-label="Cerrar"
        >
          &times;
        </button>

        {/* Navigation arrows */}
        {hasPrev && (
          <button
            onClick={onPrev}
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-12 text-white/70 hover:text-white text-3xl"
            aria-label="Anterior"
          >
            &#8249;
          </button>
        )}
        {hasNext && (
          <button
            onClick={onNext}
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-12 text-white/70 hover:text-white text-3xl"
            aria-label="Siguiente"
          >
            &#8250;
          </button>
        )}

        {/* Image */}
        <img
          src={src}
          alt={fileName}
          className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg"
        />

        {/* File name */}
        <p className="text-center text-white/70 text-sm mt-2 truncate">{fileName}</p>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------
// Helpers & Constants
// ------------------------------------------------------------------

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const FILE_ICONS: Record<string, string> = {
  'image/jpeg': 'JPG',
  'image/png': 'PNG',
  'image/webp': 'WebP',
  'application/pdf': 'PDF',
  'video/mp4': 'MP4',
  'video/quicktime': 'MOV',
}

const CATEGORY_CONFIG: Record<AttachmentCategory, { label: string; icon: string }> = {
  image:    { label: 'Imagenes',   icon: '📷' },
  document: { label: 'Documentos', icon: '📄' },
  video:    { label: 'Videos',     icon: '🎥' },
}

const CATEGORY_ORDER: AttachmentCategory[] = ['image', 'document', 'video']

/** Fallback for records without the generated column yet */
function getCategory(mimeType: string): AttachmentCategory {
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('video/')) return 'video'
  return 'document'
}

function isImage(mimeType: string): boolean {
  return mimeType.startsWith('image/')
}

// ------------------------------------------------------------------
// Main Component
// ------------------------------------------------------------------

export function AttachmentsSection({ recordId, readOnly = false }: Props) {
  const [attachments, setAttachments] = useState<AttachmentWithUrl[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showCamera, setShowCamera] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function load() {
      const result = await getAttachmentsForRecord(recordId)
      if (result.success && result.data) setAttachments(result.data)
      setLoading(false)
    }
    load()
  }, [recordId])

  // Group attachments by category
  const grouped = useMemo(() => {
    const map: Record<AttachmentCategory, AttachmentWithUrl[]> = { image: [], document: [], video: [] }
    for (const att of attachments) {
      const cat = att.category ?? getCategory(att.mime_type)
      map[cat].push(att)
    }
    return map
  }, [attachments])

  // Flat list of images for lightbox navigation
  const imageList = grouped.image

  const uploadFile = useCallback(async (file: File) => {
    setUploading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.set('file', file)

      const result = await uploadAttachment(recordId, formData)

      if (result.success && result.data) {
        setAttachments(prev => [...prev, result.data!])
      } else if (!result.success) {
        setError(result.error)
      }
    } catch {
      setError('Error al subir el archivo. Intenta nuevamente.')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
      if (cameraInputRef.current) cameraInputRef.current.value = ''
    }
  }, [recordId])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    await uploadFile(file)
  }

  function handleCameraClick() {
    const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0
    if (isMobile) {
      cameraInputRef.current?.click()
    } else {
      setShowCamera(true)
    }
  }

  function handleCameraCapture(file: File) {
    setShowCamera(false)
    uploadFile(file)
  }

  async function handleDelete(attachmentId: string) {
    const result = await deleteAttachment(recordId, attachmentId)
    if (result.success) {
      setAttachments(prev => prev.filter(a => a.id !== attachmentId))
    }
  }

  function openLightbox(att: AttachmentWithUrl) {
    const idx = imageList.findIndex(a => a.id === att.id)
    if (idx !== -1) setLightboxIndex(idx)
  }

  if (loading) {
    return (
      <Card>
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 rounded w-1/4" />
          <div className="h-16 bg-gray-200 rounded" />
        </div>
      </Card>
    )
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground-secondary">
          Evidencias ({attachments.length})
        </h3>
        {!readOnly && (
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf,video/mp4,video/quicktime"
              onChange={handleUpload}
              className="hidden"
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleUpload}
              className="hidden"
            />
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleCameraClick}
                disabled={uploading || readOnly}
              >
                {uploading ? 'Subiendo...' : 'Tomar Foto'}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || readOnly}
              >
                {uploading ? 'Subiendo...' : 'Subir Archivo'}
              </Button>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 mb-4 rounded-xl text-sm bg-red-50 text-red-700 border border-red-200">
          {error}
        </div>
      )}

      {attachments.length === 0 ? (
        <p className="text-sm text-foreground-secondary">Sin evidencias adjuntas.</p>
      ) : (
        <div className="space-y-4">
          {CATEGORY_ORDER.map(cat => {
            const items = grouped[cat]
            if (items.length === 0) return null
            const cfg = CATEGORY_CONFIG[cat]

            // Image grid with thumbnails
            if (cat === 'image') {
              return (
                <div key={cat}>
                  <p className="text-xs font-semibold text-foreground-secondary mb-2">
                    {cfg.icon} {cfg.label} ({items.length})
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {items.map(att => (
                      <div key={att.id} className="group relative">
                        <button
                          type="button"
                          onClick={() => openLightbox(att)}
                          className="block w-full aspect-square rounded-xl overflow-hidden shadow-neu-sm hover:shadow-neu-inset-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                        >
                          {att.signed_url ? (
                            <img
                              src={att.signed_url}
                              alt={att.file_name}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-full h-full bg-neu-bg shadow-neu-inset-sm flex items-center justify-center">
                              <span className="text-xs text-gray-400">{FILE_ICONS[att.mime_type] || 'IMG'}</span>
                            </div>
                          )}
                        </button>
                        <div className="mt-1.5 flex items-start justify-between gap-1">
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-foreground truncate">{att.file_name}</p>
                            <p className="text-[10px] text-foreground-secondary">{formatFileSize(att.file_size)}</p>
                          </div>
                          {!readOnly && (
                            <button
                              type="button"
                              onClick={() => handleDelete(att.id)}
                              className="text-red-500 hover:text-red-700 text-[10px] shrink-0 mt-0.5"
                            >
                              Eliminar
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            }

            // List view for documents/videos
            return (
              <div key={cat}>
                <p className="text-xs font-semibold text-foreground-secondary mb-2">
                  {cfg.icon} {cfg.label} ({items.length})
                </p>
                <div className="space-y-2">
                  {items.map(att => (
                    <div key={att.id} className="flex items-center justify-between p-3 bg-neu-bg shadow-neu-sm rounded-xl">
                      <div className="flex items-center gap-3">
                        <span className="px-2 py-1 bg-neu-bg shadow-neu-inset-sm rounded text-xs font-mono font-medium text-gray-600">
                          {FILE_ICONS[att.mime_type] || 'FILE'}
                        </span>
                        <div>
                          <p className="text-sm font-medium text-foreground truncate max-w-[200px] md:max-w-[400px]">
                            {att.file_name}
                          </p>
                          <p className="text-xs text-foreground-secondary">{formatFileSize(att.file_size)}</p>
                        </div>
                      </div>
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() => handleDelete(att.id)}
                          className="text-red-500 hover:text-red-700 text-xs"
                        >
                          Eliminar
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showCamera && (
        <CameraModal
          onCapture={handleCameraCapture}
          onClose={() => setShowCamera(false)}
        />
      )}

      {lightboxIndex !== null && imageList[lightboxIndex]?.signed_url && (
        <ImageLightbox
          src={imageList[lightboxIndex].signed_url!}
          fileName={imageList[lightboxIndex].file_name}
          onClose={() => setLightboxIndex(null)}
          onPrev={() => setLightboxIndex(i => (i !== null && i > 0 ? i - 1 : i))}
          onNext={() => setLightboxIndex(i => (i !== null && i < imageList.length - 1 ? i + 1 : i))}
          hasPrev={lightboxIndex > 0}
          hasNext={lightboxIndex < imageList.length - 1}
        />
      )}
    </Card>
  )
}
