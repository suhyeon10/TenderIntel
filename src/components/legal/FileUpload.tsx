'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Upload, FileText, X } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

interface FileUploadProps {
  onFileSelect: (file: File) => void
  accept?: string
  maxSize?: number // MB
}

export function FileUpload({ onFileSelect, accept = '.pdf,.doc,.docx,.txt', maxSize = 10 }: FileUploadProps) {
  const [file, setFile] = useState<File | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (selectedFile: File) => {
    if (selectedFile.size > maxSize * 1024 * 1024) {
      alert(`파일 크기는 ${maxSize}MB 이하여야 합니다.`)
      return
    }
    setFile(selectedFile)
    onFileSelect(selectedFile)
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0])
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileChange(e.target.files[0])
    }
  }

  const removeFile = () => {
    setFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <Card className="border-2 border-dashed border-slate-300 hover:border-blue-500 transition-colors">
      <CardContent className="p-6">
        {!file ? (
          <div
            className="flex flex-col items-center justify-center py-12"
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <div className={`w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mb-4 ${dragActive ? 'bg-blue-200' : ''}`}>
              <Upload className="w-8 h-8 text-blue-600" />
            </div>
            <p className="text-lg font-medium text-slate-700 mb-2">
              파일을 드래그하거나 클릭하여 업로드
            </p>
            <p className="text-sm text-slate-500 mb-4">
              PDF, DOC, DOCX, TXT 파일 (최대 {maxSize}MB)
            </p>
            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="outline"
              className="mt-2"
            >
              파일 선택
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept={accept}
              onChange={handleInputChange}
              className="hidden"
            />
          </div>
        ) : (
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
            <div className="flex items-center gap-3">
              <FileText className="w-8 h-8 text-blue-600" />
              <div>
                <p className="font-medium text-slate-900">{file.name}</p>
                <p className="text-sm text-slate-500">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>
            <Button
              onClick={removeFile}
              variant="ghost"
              size="icon"
              className="text-slate-500 hover:text-slate-900"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

