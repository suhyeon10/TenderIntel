'use client'

import { useState, useCallback } from 'react'
import { Upload, FileText, X, Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

type UploadStatus = 'idle' | 'uploading' | 'processing' | 'done' | 'error'

interface UploadCardProps {
  onUploadComplete?: (docId: number, chunks: number) => void
}

export function UploadCard({ onUploadComplete }: UploadCardProps) {
  const [status, setStatus] = useState<UploadStatus>('idle')
  const [file, setFile] = useState<File | null>(null)
  const [source, setSource] = useState<'narajangter' | 'ntis' | 'pdf' | 'internal'>('pdf')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ docId: number; chunks: number } | null>(null)

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const droppedFile = e.dataTransfer.files[0]
    // 모든 지원 파일 형식 허용
    if (droppedFile) {
      const ext = droppedFile.name.toLowerCase().split('.').pop()
      const supportedExts = ['pdf', 'hwp', 'hwpx', 'hwps', 'txt', 'html', 'htm']
      if (ext && supportedExts.includes(ext)) {
        setFile(droppedFile)
      } else {
        setError('지원하지 않는 파일 형식입니다. PDF, HWP, HWPX, HWPS, TXT, HTML 파일만 가능합니다.')
      }
    }
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
    }
  }

  const handleUpload = async () => {
    if (!file) {
      setError('파일을 선택해주세요')
      return
    }

    setStatus('uploading')
    setError(null)
    setProgress(0)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('source', source)
      // 파일명에서 자동으로 title 추출 (서버에서도 처리하지만 클라이언트에서도 전달)
      const title = file.name.replace(/\.[^/.]+$/, '')
      formData.append('title', title)

      // 업로드 진행률 시뮬레이션
      const xhr = new XMLHttpRequest()
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          setProgress((e.loaded / e.total) * 50) // 업로드 50%
        }
      })

      const response = await fetch('/api/rag/ingest', {
        method: 'POST',
        body: formData,
      })

      setProgress(50)
      setStatus('processing')

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '업로드 실패')
      }

      const data = await response.json()
      setProgress(100)
      setStatus('done')
      setResult(data)

      if (onUploadComplete) {
        onUploadComplete(data.docId, data.chunks)
      }
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : '업로드 실패')
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 p-5 bg-white shadow-sm">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 왼쪽: 파일 업로드 */}
        <div>
          <h3 className="text-lg font-semibold mb-4">파일 업로드</h3>

          {/* 드롭존 */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
              status === 'idle'
                ? 'border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-blue-50'
                : 'border-slate-200 bg-slate-50'
            }`}
          >
            <input
              type="file"
              accept=".pdf,.hwp,.hwpx,.hwps,.txt,.html,.htm"
              onChange={handleFileSelect}
              className="hidden"
              id="file-input"
              disabled={status !== 'idle'}
            />
            <label
              htmlFor="file-input"
              className={`cursor-pointer flex flex-col items-center ${
                status !== 'idle' ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <Upload className="w-12 h-12 text-slate-400 mb-4" />
              <p className="text-sm text-slate-600 mb-2">
                {file ? file.name : '파일을 드래그하거나 클릭하여 선택'}
              </p>
              <p className="text-xs text-slate-500">
                최대 50MB, PDF/HWP/HWPX/HWPS/TXT/HTML 지원
              </p>
            </label>
          </div>

          {file && status === 'idle' && (
            <div className="mt-4 flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-slate-600" />
                <span className="text-sm text-slate-700">{file.name}</span>
                <span className="text-xs text-slate-500">
                  ({(file.size / 1024 / 1024).toFixed(2)} MB)
                </span>
              </div>
              <button
                onClick={() => {
                  setFile(null)
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* 진행률 */}
          {(status === 'uploading' || status === 'processing') && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-slate-600">
                  {status === 'uploading' ? '업로드 중...' : '계약 조항 분석 중...'}
                </span>
                <span className="font-medium">{Math.round(progress)}%</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* 완료 */}
          {status === 'done' && result && (
            <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
              <div>
                <p className="font-semibold text-emerald-800">업로드 완료!</p>
                <p className="text-sm text-emerald-600">
                  문서 ID: {result.docId}, 청크 수: {result.chunks}
                </p>
              </div>
            </div>
          )}

          {/* 오류 */}
          {status === 'error' && error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <div>
                <p className="font-semibold text-red-800">오류 발생</p>
                <p className="text-sm text-red-600">{error}</p>
              </div>
            </div>
          )}
        </div>

        {/* 오른쪽: 업로드 정보 및 버튼 */}
        <div>
          <h3 className="text-lg font-semibold mb-4">업로드 정보</h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">출처</label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value as any)}
                className="w-full p-2 border border-slate-300 rounded-xl"
                disabled={status !== 'idle'}
              >
                <option value="pdf">파일 업로드</option>
                <option value="narajangter">나라장터</option>
                <option value="ntis">NTIS</option>
                <option value="internal">내부 문서</option>
              </select>
            </div>

            {file && (
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-sm font-medium text-slate-700 mb-1">파일 정보</p>
                <p className="text-xs text-slate-600">제목: {file.name.replace(/\.[^/.]+$/, '')}</p>
                <p className="text-xs text-slate-600">크기: {(file.size / 1024 / 1024).toFixed(2)} MB</p>
                <p className="text-xs text-slate-600">형식: {file.name.split('.').pop()?.toUpperCase()}</p>
              </div>
            )}

            <div className="text-xs text-slate-500 space-y-1">
              <p>• 파일명이 자동으로 제목으로 사용됩니다</p>
              <p>• 서버에서 파일 형식을 자동으로 감지합니다</p>
              <p>• 메타데이터는 파일 내용에서 자동 추출됩니다</p>
            </div>

            <Button
              onClick={handleUpload}
              disabled={!file || status !== 'idle'}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-4 py-2 font-medium shadow-sm"
              size="lg"
            >
              {status === 'idle' && '업로드 및 인덱싱'}
              {status === 'uploading' && (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  업로드 중...
                </>
              )}
              {status === 'processing' && (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  계약 조항 분석 중...
                </>
              )}
              {status === 'done' && '완료'}
              {status === 'error' && '재시도'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

