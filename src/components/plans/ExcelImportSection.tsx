'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { importPlanFromExcel, type ImportResult } from '@/actions/excel-import'

interface Props {
  planId: string
}

export function ExcelImportSection({ planId }: Props) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    setSelectedFile(file)
    setError(null)
    setResult(null)
  }

  function handleDropzoneClick() {
    fileInputRef.current?.click()
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (!file) return
    const name = file.name.toLowerCase()
    if (!name.endsWith('.xlsx') && !name.endsWith('.xls')) {
      setError('Solo se aceptan archivos .xlsx o .xls')
      return
    }
    setSelectedFile(file)
    setError(null)
    setResult(null)
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
  }

  async function handleImport() {
    if (!selectedFile) return

    setImporting(true)
    setError(null)
    setResult(null)

    const formData = new FormData()
    formData.set('file', selectedFile)

    const response = await importPlanFromExcel(planId, formData)

    if (!response.success) {
      setError(response.error)
    } else if (response.data) {
      setResult(response.data)
      setSelectedFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }

    setImporting(false)
  }

  return (
    <Card>
      <h3 className="text-sm font-semibold text-foreground-secondary mb-4">
        Importar desde Excel
      </h3>

      {/* Dropzone */}
      <div
        role="button"
        tabIndex={0}
        onClick={handleDropzoneClick}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onKeyDown={(e) => e.key === 'Enter' && handleDropzoneClick()}
        className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-colors"
        aria-label="Seleccionar archivo Excel para importar"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileChange}
          className="hidden"
          aria-hidden="true"
        />
        {selectedFile ? (
          <div>
            <p className="text-sm font-medium text-foreground">{selectedFile.name}</p>
            <p className="text-xs text-foreground-secondary mt-1">
              {(selectedFile.size / 1024).toFixed(1)} KB — Haz clic para cambiar
            </p>
          </div>
        ) : (
          <div>
            <svg
              className="mx-auto h-10 w-10 text-foreground-secondary mb-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-sm font-medium text-foreground">Seleccionar archivo</p>
            <p className="text-xs text-foreground-secondary mt-1">
              Arrastra aqui o haz clic — .xlsx o .xls, maximo 5 MB
            </p>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Success result */}
      {result && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-xl">
          <p className="text-sm font-medium text-green-800">
            Importacion exitosa: {result.categoriesCreated} categoria{result.categoriesCreated !== 1 ? 's' : ''} y {result.tasksCreated} tarea{result.tasksCreated !== 1 ? 's' : ''} importadas.
          </p>
          {result.warnings.length > 0 && (
            <ul className="mt-2 space-y-1">
              {result.warnings.map((w, i) => (
                <li key={i} className="text-xs text-yellow-700">
                  {w}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Import button */}
      <div className="mt-4">
        <Button
          onClick={handleImport}
          isLoading={importing}
          disabled={!selectedFile || importing}
        >
          Importar
        </Button>
      </div>
    </Card>
  )
}
