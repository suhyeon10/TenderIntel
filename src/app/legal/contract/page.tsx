'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  Upload, 
  FileText, 
  Loader2, 
  History, 
  Calendar, 
  AlertTriangle, 
  CheckCircle2,
  ArrowRight,
  ShieldAlert,
  Sparkles,
  FileCheck,
  Info,
  X,
  Zap
} from 'lucide-react'
import { analyzeContractV2, getContractHistoryV2 } from '@/apis/legal.service'
import { uploadContractFile, saveContractAnalysis } from '@/apis/contract-history.service'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

interface HistoryItem {
  id: string
  file_name: string
  risk_score: number
  risk_level: 'low' | 'medium' | 'high'
  summary?: string
  created_at: string
  analysis_result?: {
    issues?: any[]
  }
}

export default function ContractAnalysisPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [file, setFile] = useState<File | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [isDragging, setIsDragging] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const [analysisStep, setAnalysisStep] = useState<number>(0)
  const [isQuickSample, setIsQuickSample] = useState(false) // 시연용 바이패스 플래그

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      validateAndSetFile(selectedFile)
    }
  }

  const validateAndSetFile = (selectedFile: File) => {
    setUploadError(null)
    
    // 파일 크기 체크 (10MB)
    if (selectedFile.size > 10 * 1024 * 1024) {
      setUploadError('파일 크기는 10MB를 초과할 수 없습니다.')
      return
    }

    // 파일 형식 체크
    const allowedExtensions = ['.pdf', '.hwpx', '.hwp']
    const fileExtension = selectedFile.name.toLowerCase().substring(selectedFile.name.lastIndexOf('.'))
    if (!allowedExtensions.includes(fileExtension)) {
      setUploadError('지원되는 형식: PDF, HWPX (일반 HWP는 변환 필요)')
      return
    }

    setFile(selectedFile)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) {
      validateAndSetFile(droppedFile)
    }
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
  }

  // 히스토리 로드
  const loadHistory = async () => {
    try {
      setLoadingHistory(true)
      // v2 API로 히스토리 조회 시도
      try {
        const historyData = await getContractHistoryV2(10, 0)
        const formattedHistory: HistoryItem[] = historyData.map(item => ({
          id: item.doc_id,
          file_name: item.original_filename || item.title,
          risk_score: item.risk_score,
          risk_level: item.risk_level as 'low' | 'medium' | 'high',
          summary: item.summary,
          created_at: item.created_at,
          analysis_result: {
            issues: Array(item.issue_count).fill(null), // 이슈 개수만 표시
          },
        }))
        setHistory(formattedHistory)
      } catch (apiError: any) {
        // API 조회 실패 시 로컬 스토리지에서 조회
        console.warn('v2 API 히스토리 조회 실패, 로컬 스토리지 확인:', apiError)
        const localHistory: HistoryItem[] = []
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)
          if (key?.startsWith('contract_analysis_')) {
            try {
              const docId = key.replace('contract_analysis_', '')
              const data = JSON.parse(localStorage.getItem(key) || '{}')
              if (data && (data.riskScore !== undefined || data.risk_score !== undefined)) {
                localHistory.push({
                  id: docId,
                  file_name: data.title || data.file_name || '계약서',
                  risk_score: data.riskScore || data.risk_score || 0,
                  risk_level: (data.riskLevel || data.risk_level || 'low') as 'low' | 'medium' | 'high',
                  summary: data.summary || '',
                  created_at: data.createdAt || data.created_at || new Date().toISOString(),
                  analysis_result: {
                    issues: Array((data.issues || data.risks || []).length).fill(null),
                  },
                })
              }
            } catch (e) {
              // 무시
            }
          }
        }
        // 최신순으로 정렬
        localHistory.sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
        setHistory(localHistory.slice(0, 10))
      }
    } catch (error) {
      console.error('히스토리 로드 실패:', error)
      setHistory([])
    } finally {
      setLoadingHistory(false)
    }
  }

  useEffect(() => {
    loadHistory()
  }, [])

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return dateString
    }
  }

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'high':
        return 'text-red-700 bg-red-50 border-red-200'
      case 'medium':
        return 'text-amber-700 bg-amber-50 border-amber-200'
      default:
        return 'text-emerald-700 bg-emerald-50 border-emerald-200'
    }
  }

  const getRiskLabel = (riskLevel: string) => {
    switch (riskLevel) {
      case 'high':
        return '높음'
      case 'medium':
        return '보통'
      default:
        return '낮음'
    }
  }

  const handleAnalyze = async () => {
    if (!file) {
      toast({
        variant: 'destructive',
        title: '파일 선택 필요',
        description: '파일을 선택해주세요.',
      })
      return
    }

    setIsAnalyzing(true)
    setAnalysisError(null)
    setAnalysisStep(1)

    try {
      // Step 1: 파일 업로드
      let fileUrl: string | null = null
      try {
        fileUrl = await uploadContractFile(file)
        if (fileUrl) {
          console.log('파일 업로드 완료:', fileUrl)
        }
      } catch (uploadError: any) {
        console.warn('파일 업로드 실패, 분석은 계속 진행:', uploadError)
        fileUrl = null
      }

      setAnalysisStep(2)

      // Step 2: 계약서 분석 수행 (v2)
      const result = await analyzeContractV2(file, file.name, 'employment')
      
      setAnalysisStep(3)
      
      // 응답 확인 및 로깅 (상세)
      console.group('📦 [계약서 분석] ========== 프론트엔드 응답 받음 ==========')
      console.log('✅ 전체 응답 객체:', result)
      console.log('📋 JSON 문자열:', JSON.stringify(result, null, 2))
      console.log('🔑 응답 키 목록:', result ? Object.keys(result) : [])
      console.log('📊 응답 상세:', {
        docId: result?.docId,
        hasContractText: !!result?.contractText,
        contractTextLength: result?.contractText?.length || 0,
        contractTextPreview: result?.contractText?.substring(0, 200) || '(없음)',
        riskScore: result?.riskScore,
        riskLevel: result?.riskLevel,
        issuesCount: result?.issues?.length || 0,
        issues: result?.issues,
        summary: result?.summary?.substring(0, 100) || '(없음)',
        hasRetrievedContexts: !!(result?.retrievedContexts && result.retrievedContexts.length > 0),
        retrievedContextsCount: result?.retrievedContexts?.length || 0,
      })
      
      // 백엔드 응답 형식 확인 (v1 vs v2)
      const isV2Format = result && 'docId' in result && 'contractText' in result && 'issues' in result
      const isV1Format = result && 'risks' in result && 'references' in result
      console.log('🔍 응답 형식 확인:', {
        isV2Format,
        isV1Format,
        isUnknownFormat: !isV2Format && !isV1Format
      })
      
      if (!isV2Format && isV1Format) {
        console.error('❌ [계약서 분석] 백엔드가 v1 형식으로 응답했습니다! v2 형식이 필요합니다.')
      } else if (isV2Format) {
        console.log('✅ [계약서 분석] v2 형식 응답 확인됨')
      }
      console.groupEnd()
      
      // docId는 v2 응답에서 받음
      let docId = result?.docId
      
      // docId가 없으면 임시 ID 생성 (fallback)
      if (!docId) {
        console.warn('[계약서 분석] docId가 없어 임시 ID 생성:', result)
        docId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      }
      
      // contractText 확인
      const contractText = result?.contractText || ''
      if (!contractText || contractText.trim().length === 0) {
        console.warn('[계약서 분석] ⚠️ 백엔드 응답에 contractText가 없습니다!', {
          docId,
          resultKeys: result ? Object.keys(result) : [],
          resultContractText: result?.contractText
        })
      }
      
      // Step 3: 분석 결과를 로컬 스토리지에 먼저 저장 (임시 ID인 경우에도)
      // 백엔드 v2 응답 전체를 저장 (contractText, issues, recommendations 모두 포함)
      const analysisData = {
        ...result, // 백엔드 응답 전체 포함 (docId, title, riskScore, riskLevel, sections, issues, summary, retrievedContexts, contractText, createdAt)
        // 호환성을 위해 contractText와 contract_text 둘 다 저장
        contractText: result.contractText ?? contractText ?? '',
        contract_text: result.contractText ?? contractText ?? '',
        // 추가 메타데이터
        risk_score: result.riskScore,
        risk_level: result.riskLevel,
        fileUrl,
        docId: docId, // docId도 함께 저장
        // issues와 recommendations는 result에 이미 포함되어 있음
      }
      // 저장 전 확인
      console.log('[계약서 분석] 로컬 스토리지에 저장하기 전:', {
        docId,
        contractTextLength: contractText.length,
        contractTextPreview: contractText.substring(0, 100) || '(없음)',
        hasContractText: contractText.length > 0,
        analysisDataKeys: Object.keys(analysisData),
        analysisDataContractText: analysisData.contractText?.substring(0, 50) || '(없음)',
        analysisDataContract_text: analysisData.contract_text?.substring(0, 50) || '(없음)',
        fullAnalysisData: analysisData // 전체 데이터 확인
      })
      
      localStorage.setItem(`contract_analysis_${docId}`, JSON.stringify(analysisData))
      
      // 저장 후 확인
      const savedData = localStorage.getItem(`contract_analysis_${docId}`)
      const parsedSavedData = savedData ? JSON.parse(savedData) : null
      console.log('[계약서 분석] 로컬 스토리지에 저장 완료:', {
        docId,
        contractTextLength: contractText.length,
        hasContractText: contractText.length > 0,
        savedDataLength: savedData?.length || 0,
        savedDataPreview: savedData ? savedData.substring(0, 200) : '(없음)',
        parsedSavedDataContractText: parsedSavedData?.contractText?.substring(0, 50) || '(없음)',
        parsedSavedDataContract_text: parsedSavedData?.contract_text?.substring(0, 50) || '(없음)',
        parsedSavedDataKeys: parsedSavedData ? Object.keys(parsedSavedData) : []
      })
      
      // Step 4: 분석 결과를 DB에 저장 (선택적, 실패해도 계속 진행)
      try {
        if (fileUrl && result.issues && Array.isArray(result.issues)) {
          // v2 형식에 맞춰 변환
          const v1Format = {
            risk_score: result.riskScore,
            risk_level: result.riskLevel,
            summary: result.summary,
            issues: (result.issues || []).map((issue: any) => ({
              name: issue.summary || issue.name || '',
              description: issue.explanation || issue.description || '',
              severity: issue.severity || 'medium',
              legal_basis: issue.legalBasis || issue.legal_basis || [],
              suggested_text: issue.suggestedRevision || issue.suggested_text || '',
            })),
            recommendations: [],
            grounding: (result.retrievedContexts || []).map((ctx: any) => ({
              source_id: '',
              source_type: ctx.sourceType || ctx.source_type || 'law',
              title: ctx.title || '',
              snippet: ctx.snippet || '',
              score: 0,
            })),
            contract_text: contractText || '',
          }
          const savedId = await saveContractAnalysis(file, fileUrl, v1Format)
          console.log('분석 결과 DB 저장 완료, ID:', savedId)
        }
      } catch (saveError: any) {
        console.warn('DB 저장 실패, 로컬 스토리지만 사용:', saveError)
        // DB 저장 실패해도 계속 진행 (로컬 스토리지에 이미 저장됨)
      }
      
      // 히스토리 다시 로드
      await loadHistory()
      
      // 상세 페이지로 이동
      router.push(`/legal/contract/${docId}`)
    } catch (error: any) {
      console.error('분석 오류:', error)
      
      // 에러 타입별 처리
      let errorMessage = '분석 중 오류가 발생했습니다.'
      let errorTitle = '분석 실패'
      
      if (error.message?.includes('400')) {
        errorMessage = '파일 형식이 올바르지 않습니다. PDF 또는 HWPX 파일을 업로드해주세요.'
        errorTitle = '파일 형식 오류'
      } else if (error.message?.includes('422')) {
        errorMessage = '파일 내용을 분석할 수 없습니다. 텍스트가 포함된 파일인지 확인해주세요.'
        errorTitle = '파일 분석 불가'
      } else if (error.message?.includes('500')) {
        errorMessage = '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
        errorTitle = '서버 오류'
      } else if (error.message?.includes('문서 ID')) {
        errorMessage = '분석은 완료되었지만 문서 ID를 받지 못했습니다. 잠시 후 다시 시도해주세요.'
        errorTitle = '문서 ID 오류'
      } else {
        errorMessage = error.message || errorMessage
      }
      
      setAnalysisError(errorMessage)
      setIsAnalyzing(false)
      setAnalysisStep(0)
      toast({
        variant: 'destructive',
        title: errorTitle,
        description: errorMessage,
      })
    }
  }

  // 시연용 바이패스: 미리 분석된 docId로 바로 이동
  const handleQuickSample = async () => {
    const latestHistoryId = history[0]?.id

    if (!latestHistoryId) {
      await handleSampleContract('intern')
      return
    }

    setIsAnalyzing(true)
    setIsQuickSample(true) // 시연용 바이패스 플래그 설정
    setAnalysisStep(-1) // 특별한 값으로 설정하여 간단한 로딩 메시지 표시
    setAnalysisError(null)
    
    // 짧은 로딩 시뮬레이션 (30초~1분 대신 1~2초)
    // "계약 조항 읽는 중" 같은 간단한 메시지만 보여줌
    setTimeout(() => {
      router.push(`/legal/contract/${latestHistoryId}`)
    }, 1500)
  }

  const handleSampleContract = async (sampleType: 'intern' | 'freelancer') => {
    try {
      setIsAnalyzing(true)
      setAnalysisError(null)
      setAnalysisStep(1)

      // 샘플 파일 경로 설정
      const sampleFiles = {
        intern: '/samples/sample_intern_contract.pdf',
        freelancer: '/samples/sample_freelancer_contract.pdf'
      }

      const filePath = sampleFiles[sampleType]
      const fileName = sampleType === 'intern' 
        ? 'IT_인턴_근로계약서_샘플.pdf' 
        : '프리랜서_용역계약서_샘플.pdf'

      // 파일 fetch
      const response = await fetch(filePath)
      if (!response.ok) {
        throw new Error(`샘플 파일을 불러올 수 없습니다: ${filePath}`)
      }

      const blob = await response.blob()
      
      // Blob을 File 객체로 변환
      const sampleFile = new File([blob], fileName, { 
        type: blob.type || 'application/pdf' 
      })

      setFile(sampleFile)
      setAnalysisStep(2)

      // Step 1: 파일 업로드 (선택적)
      let fileUrl: string | null = null
      try {
        fileUrl = await uploadContractFile(sampleFile)
        if (fileUrl) {
          console.log('샘플 파일 업로드 완료:', fileUrl)
        }
      } catch (uploadError: any) {
        console.warn('샘플 파일 업로드 실패, 분석은 계속 진행:', uploadError)
        fileUrl = null
      }

      setAnalysisStep(3)

      // Step 2: 계약서 분석 수행 (v2)
      const docType = sampleType === 'intern' ? 'employment' : 'freelance'
      const result = await analyzeContractV2(sampleFile, fileName, docType)
      
      // 응답 확인 및 로깅
      console.log('📦 [샘플 계약서 분석] 응답 받음:', result)
      
      // docId 확인
      let docId = result?.docId
      if (!docId) {
        console.warn('[샘플 계약서 분석] docId가 없어 임시 ID 생성')
        docId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      }
      
      // contractText 확인
      const contractText = result?.contractText || ''
      
      // Step 3: 분석 결과를 로컬 스토리지에 저장
      const analysisData = {
        ...result,
        contractText: result.contractText ?? contractText ?? '',
        contract_text: result.contractText ?? contractText ?? '',
        risk_score: result.riskScore,
        risk_level: result.riskLevel,
        fileUrl,
        docId: docId,
      }
      
      localStorage.setItem(`contract_analysis_${docId}`, JSON.stringify(analysisData))
      console.log('[샘플 계약서 분석] 로컬 스토리지에 저장 완료:', docId)
      
      // Step 4: 분석 결과를 DB에 저장 (선택적)
      try {
        if (fileUrl && result.issues && Array.isArray(result.issues)) {
          const v1Format = {
            risk_score: result.riskScore,
            risk_level: result.riskLevel,
            summary: result.summary,
            issues: (result.issues || []).map((issue: any) => ({
              name: issue.summary || issue.name || '',
              description: issue.explanation || issue.description || '',
              severity: issue.severity || 'medium',
              legal_basis: issue.legalBasis || issue.legal_basis || [],
              suggested_text: issue.suggestedRevision || issue.suggested_text || '',
            })),
            recommendations: [],
            grounding: (result.retrievedContexts || []).map((ctx: any) => ({
              source_id: '',
              source_type: ctx.sourceType || ctx.source_type || 'law',
              title: ctx.title || '',
              snippet: ctx.snippet || '',
              score: 0,
            })),
            contract_text: contractText || '',
          }
          await saveContractAnalysis(sampleFile, fileUrl, v1Format)
          console.log('샘플 계약서 분석 결과 DB 저장 완료')
        }
      } catch (saveError: any) {
        console.warn('샘플 계약서 DB 저장 실패, 로컬 스토리지만 사용:', saveError)
      }
      
      // 히스토리 다시 로드
      await loadHistory()
      
      // 상세 페이지로 이동
      router.push(`/legal/contract/${docId}`)
    } catch (error: any) {
      console.error('샘플 계약서 분석 오류:', error)
      
      let errorMessage = '샘플 계약서 분석 중 오류가 발생했습니다.'
      if (error.message?.includes('샘플 파일을 불러올 수 없습니다')) {
        errorMessage = error.message
      }
      
      setAnalysisError(errorMessage)
      setIsAnalyzing(false)
      setAnalysisStep(0)
      toast({
        variant: 'destructive',
        title: '샘플 계약서 분석 실패',
        description: errorMessage,
      })
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const getFileIcon = (fileName: string) => {
    const ext = fileName.toLowerCase().split('.').pop()
    if (ext === 'pdf') return '📄'
    if (ext === 'hwpx' || ext === 'hwp') return '📝'
    return '📎'
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-slate-50">
      <main className="container mx-auto px-4 sm:px-6 py-8 sm:py-12 max-w-7xl">
        {/* 상단 영역: 페이지 타이틀 & 설명 */}
        <div className="mb-12">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
            {/* 좌측: 타이틀 & 설명 */}
            <div className="flex-1">
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold mb-4 text-slate-900 leading-tight">
                계약서 올리고,<br />
                AI에게 먼저 점검 받아보세요
              </h1>
              <p className="text-base md:text-lg text-slate-600 leading-relaxed mb-6">
                근로·프리랜서·용역·스톡옵션 계약서를 업로드하면<br />
                위험 조항, 법령 기준과의 차이, 수정이 필요한 부분을 카드로 정리해 드립니다.
              </p>
            </div>

            {/* 우측: 배지/태그 */}
            <div className="flex flex-wrap gap-2 lg:flex-col lg:items-end">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 text-xs font-semibold text-blue-700 border border-blue-200">
                <Zap className="w-3 h-3" />
                청년 · 프리랜서 대상
              </div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-50 text-xs font-semibold text-purple-700 border border-purple-200">
                <Sparkles className="w-3 h-3" />
                해커톤 데모 버전
              </div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 text-xs font-semibold text-amber-700 border border-amber-200">
                <Info className="w-3 h-3" />
                법률 정보 제공 서비스
              </div>
            </div>
          </div>
        </div>

        {/* 메인: 2컬럼 레이아웃 */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 mb-12">
          {/* 좌측: 업로드 영역 (약 60%) */}
          <div className="lg:col-span-3 space-y-6">
            {/* 업로드 카드 */}
            <Card className="border-2 border-slate-200 shadow-xl bg-white">
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-md">
                    <Upload className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-bold">1. 계약서 파일 업로드</CardTitle>
                    <CardDescription className="mt-1">
                      PDF, HWPX 파일을 올려주세요.<br />
                      <span className="text-amber-600">스캔본(이미지) 계약서는 현재 데모에서 정확도가 떨어질 수 있습니다.</span>
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* 업로드 박스 */}
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onClick={() => !file && document.getElementById('file-input')?.click()}
                  onKeyDown={(e) => {
                    if ((e.key === 'Enter' || e.key === ' ') && !file) {
                      e.preventDefault()
                      document.getElementById('file-input')?.click()
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label="계약서 파일 업로드 영역"
                  aria-describedby="upload-instructions"
                  className={cn(
                    "border-2 border-dashed rounded-2xl p-12 text-center transition-all cursor-pointer relative",
                    isDragging 
                      ? "border-blue-500 bg-blue-50/50 shadow-lg" 
                      : file 
                        ? "border-slate-300 bg-slate-50" 
                        : "border-slate-300 bg-white hover:border-blue-400 hover:bg-blue-50/30 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  )}
                >
                  <input
                    id="file-input"
                    type="file"
                    accept=".pdf,.hwpx,.hwp"
                    onChange={handleFileSelect}
                    className="hidden"
                    aria-label="계약서 파일 선택"
                  />

                  {!file ? (
                    <>
                      <div className={cn(
                        "w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center transition-all",
                        isDragging 
                          ? "bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg scale-110" 
                          : "bg-gradient-to-br from-slate-100 to-slate-200"
                      )}>
                        <Upload className={cn(
                          "w-10 h-10 transition-colors",
                          isDragging ? "text-white" : "text-slate-400"
                        )} />
                      </div>
                      <p 
                        id="upload-instructions"
                        className={cn(
                          "text-lg font-bold mb-2 transition-colors",
                          isDragging ? "text-blue-700" : "text-slate-700"
                        )}
                      >
                        {isDragging 
                          ? "파일을 여기로 가져오면 바로 분석을 시작할 수 있어요." 
                          : "여기에 파일을 드래그하거나 클릭해서 선택하세요"}
                      </p>
                      <p className="text-sm text-slate-500 mt-2">
                        지원 형식: PDF, HWPX (일반 HWP는 변환 필요)<br />
                        최대 10MB (데모 환경 기준)
                      </p>
                    </>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-center gap-4">
                        <div className="text-5xl">{getFileIcon(file.name)}</div>
                        <div className="text-left">
                          <p className="text-lg font-bold text-slate-900 mb-1">{file.name}</p>
                          <p className="text-sm text-slate-500">{formatFileSize(file.size)}</p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          setFile(null)
                          setUploadError(null)
                        }}
                        className="text-slate-600 hover:text-slate-900"
                      >
                        <X className="w-4 h-4 mr-2" />
                        다른 파일로 변경하기
                      </Button>
                    </div>
                  )}
                </div>

                {/* 업로드 에러 메시지 */}
                {uploadError && (
                  <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-red-700">{uploadError}</p>
                </div>
              </div>
                )}

                {/* 분석 버튼 영역 */}
                {file && !isAnalyzing && (
                  <div className="mt-6 space-y-3">
                    <Button
                      onClick={handleAnalyze}
                      disabled={isAnalyzing}
                      className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg h-14 text-base font-semibold"
                      size="lg"
                    >
                      <FileCheck className="w-5 h-5 mr-2" />
                      이 계약서로 위험도 분석 시작하기
                    </Button>
                    <p className="text-xs text-center text-slate-500">
                      분석에는 10~20초 정도 걸릴 수 있습니다. (해커톤 데모 환경 기준)<br />
                      분석이 끝나면 상세 페이지로 자동 이동합니다.
                    </p>
                  </div>
                )}

                {/* 분석 중 로딩 */}
                {isAnalyzing && (
                  <div className="mt-6 space-y-4">
                    {/* 시연용 바이패스: 간단한 로딩 메시지 */}
                    {isQuickSample ? (
                      <div className="text-center py-12">
                        <div className="relative inline-block mb-4">
                          <div className="absolute inset-0 w-16 h-16 border-4 border-blue-100 rounded-full animate-pulse"></div>
                          <Loader2 className="w-16 h-16 animate-spin text-blue-600 relative" />
                        </div>
                        <p className="text-lg font-bold text-slate-900 mb-2">계약 조항 읽는 중...</p>
                        <p className="text-sm text-slate-600">
                          분석 결과를 불러오고 있습니다.
                        </p>
                      </div>
                    ) : (
                      <>
                    {/* Step Progress Indicator */}
                    <div className="flex items-center justify-between mb-6">
                      {[
                        { step: 1, label: '텍스트 추출' },
                        { step: 2, label: '조항 분류' },
                        { step: 3, label: '위험도 분석' },
                      ].map((item) => (
                        <div key={item.step} className="flex-1 flex flex-col items-center">
                          <div className={cn(
                            "w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm mb-2 transition-all",
                            analysisStep >= item.step
                              ? "bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg scale-110"
                              : "bg-slate-200 text-slate-400"
                          )}>
                            {analysisStep > item.step ? (
                              <CheckCircle2 className="w-6 h-6" />
                            ) : (
                              item.step
                            )}
                          </div>
                          <p className={cn(
                            "text-xs font-medium text-center",
                            analysisStep >= item.step ? "text-blue-600" : "text-slate-400"
                          )}>
                            {item.label}
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className="text-center py-8">
                      <div className="relative inline-block mb-4">
                        <div className="absolute inset-0 w-16 h-16 border-4 border-blue-100 rounded-full animate-pulse"></div>
                        <Loader2 className="w-16 h-16 animate-spin text-blue-600 relative" />
                      </div>
                      <p className="text-lg font-bold text-slate-900 mb-2">분석 중...</p>
                      <p className="text-sm text-slate-600">
                        법령·표준계약서와 비교하여 위험 신호를 찾고 있습니다.
                      </p>
                    </div>
                      </>
                    )}
                  </div>
                )}

                {/* 분석 실패 에러 */}
                {analysisError && (
                  <div className="mt-6 p-6 bg-red-50 border-2 border-red-200 rounded-xl">
                    <div className="flex items-start gap-3 mb-4">
                      <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <h3 className="font-bold text-red-900 mb-2">계약서 분석에 실패했습니다.</h3>
                        <p className="text-sm text-red-700 mb-4">{analysisError}</p>
                        <ul className="text-sm text-red-700 space-y-1 mb-4">
                          <li>· 이미지 기반 스캔 PDF일 수 있어요.</li>
                          <li>· 다시 시도하거나, 다른 파일로 테스트해 주세요.</li>
                        </ul>
                        <div className="flex gap-3">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setAnalysisError(null)
                              setFile(null)
                            }}
                            className="border-red-300 text-red-700 hover:bg-red-50"
                          >
                            다시 시도하기
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSampleContract('intern')}
                            className="border-slate-300"
                          >
                            샘플 계약서로 대신 살펴보기
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 샘플 계약서 섹션 */}
            {!file && !isAnalyzing && (
              <Card className="border-2 border-slate-200 shadow-lg bg-gradient-to-br from-white to-slate-50/50">
                <CardContent className="p-6">
                  <p className="text-sm text-slate-600 mb-4 text-center">
                    계약서가 없나요? 샘플로 먼저 구경해보세요.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Button
                      variant="outline"
                      onClick={() => handleSampleContract('intern')}
                      className="h-auto py-4 border-2 border-slate-300 hover:border-blue-400 hover:bg-blue-50"
                    >
                      <div className="text-left w-full">
                        <p className="font-semibold text-slate-900 mb-1">IT 인턴 근로계약</p>
                        <p className="text-xs text-slate-600">샘플로 분석하기</p>
                      </div>
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleSampleContract('freelancer')}
                      className="h-auto py-4 border-2 border-slate-300 hover:border-blue-400 hover:bg-blue-50"
                    >
                      <div className="text-left w-full">
                        <p className="font-semibold text-slate-900 mb-1">프리랜서 용역 계약</p>
                        <p className="text-xs text-slate-600">샘플로 분석하기</p>
                      </div>
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => void handleQuickSample()}
                      className="h-auto py-4 border-2 border-blue-300 hover:border-blue-500 hover:bg-blue-50 bg-blue-50/50"
                    >
                      <div className="text-left w-full">
                        <p className="font-semibold text-slate-900 mb-1">시연용 계약서</p>
                        <p className="text-xs text-blue-600">즉시 결과 보기</p>
                      </div>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* 우측: 히스토리 & 안내 (약 40%) */}
          <div className="lg:col-span-2 space-y-6">
            {/* 최근 분석 카드 */}
            <Card className="border-2 border-slate-200 shadow-lg bg-white">
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl shadow-md">
                    <History className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-bold">최근에 분석한 계약서</CardTitle>
                    <CardDescription className="text-xs mt-1">
                      다시 보고 싶은 분석 결과가 있다면 여기서 바로 이동할 수 있습니다.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loadingHistory ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="text-center">
                      <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
                      <p className="text-sm text-slate-600">내역을 불러오는 중...</p>
                    </div>
                  </div>
                ) : history.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="p-4 bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl w-16 h-16 mx-auto mb-4 shadow-md">
                      <History className="w-8 h-8 text-slate-400" />
                    </div>
                    <p className="text-sm font-medium text-slate-700 mb-2">
                      아직 분석한 계약서가 없습니다.
                    </p>
                    <p className="text-xs text-slate-500 mb-4">
                      첫 계약서를 올려서, 위험 신호를 미리 점검해 보세요.
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        document.getElementById('file-input')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                        setTimeout(() => document.getElementById('file-input')?.click(), 500)
                      }}
                      className="text-blue-600 hover:text-blue-700"
                      aria-label="첫 계약서 분석 시작하기"
                    >
                      첫 분석 시작하기
                      <ArrowRight className="w-4 h-4 ml-2" aria-hidden="true" />
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {history.slice(0, 5).map((item) => {
                      const issueCount = item.analysis_result?.issues?.length || 0
                      return (
                        <Card
                          key={item.id}
                          onClick={() => router.push(`/legal/contract/${item.id}`)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              router.push(`/legal/contract/${item.id}`)
                            }
                          }}
                          role="button"
                          tabIndex={0}
                          aria-label={`${item.file_name || '계약서'} 분석 결과 보기, 위험도: ${getRiskLabel(item.risk_level)}, 점수: ${item.risk_score}점`}
                          className="border-2 border-slate-200 rounded-xl hover:border-blue-400 hover:shadow-md transition-all cursor-pointer bg-white group focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                  <div className="p-1 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-lg">
                                    <FileText className="w-3 h-3 text-blue-600" />
                                  </div>
                                  <p className="text-sm font-bold text-slate-900 truncate group-hover:text-blue-700 transition-colors">
                                    {item.file_name || '계약서'}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                                  <Calendar className="w-3 h-3" />
                                  <span>{formatDate(item.created_at)}</span>
                                </div>
                              </div>
                              <div className={cn(
                                "px-2 py-1 text-xs font-bold rounded-full border flex-shrink-0 shadow-sm",
                                getRiskColor(item.risk_level)
                              )}>
                                {getRiskLabel(item.risk_level)}
                              </div>
                            </div>

                            <div className="flex items-center gap-4 mb-3 pb-3 border-b border-slate-100">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs text-slate-600">위험도:</span>
                                <span className="text-sm font-extrabold text-slate-900">{item.risk_score}점</span>
                              </div>
                              {issueCount > 0 && (
                                <div className="flex items-center gap-1.5">
                                  <AlertTriangle className="w-3 h-3 text-amber-500" />
                                  <span className="text-xs font-medium text-slate-700">{issueCount}개 조항</span>
                                </div>
                              )}
                            </div>

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                router.push(`/legal/contract/${item.id}`)
                              }}
                              className="w-full text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            >
                              분석 결과 다시 보기
                              <ArrowRight className="w-3 h-3 ml-2" />
                            </Button>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 안내/Tip 섹션 */}
            <Card className="border-2 border-blue-200 shadow-lg bg-gradient-to-br from-blue-50/50 to-indigo-50/50">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-md">
                    <Info className="w-5 h-5 text-white" />
                  </div>
                  <CardTitle className="text-lg font-bold">어떤 계약서를 올리면 좋나요?</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-slate-700">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 mt-1">·</span>
                    <span>첫 입사/인턴/수습 근로계약서</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 mt-1">·</span>
                    <span>프리랜서/용역 계약서</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 mt-1">·</span>
                    <span>스톡옵션/인센티브/성과급 조항이 포함된 계약서</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* 데모 버전 한계 안내 */}
            <Card className="border-2 border-amber-200 shadow-lg bg-amber-50/50">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-100 rounded-xl">
                    <AlertTriangle className="w-5 h-5 text-amber-700" />
                  </div>
                  <CardTitle className="text-lg font-bold">현재 데모 버전에서의 한계</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-amber-800">
                  <li className="flex items-start gap-2">
                    <span className="text-amber-600 mt-1">·</span>
                    <span>스캔된 이미지 기반 PDF는 텍스트 추출이 잘 안 될 수 있어요.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-600 mt-1">·</span>
                    <span>일반 HWP는 변환 후 업로드하는 걸 권장합니다.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-600 mt-1">·</span>
                    <span>이 서비스는 법률 자문이 아니라, 정보 제공용입니다.</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* 페이지 하단 디스클레이머 */}
        {!isAnalyzing && (
          <Card className="bg-amber-50 border-2 border-amber-200 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="p-2 bg-amber-100 rounded-lg flex-shrink-0">
                  <ShieldAlert className="w-6 h-6 text-amber-700" />
                </div>
                <div className="flex-1">
                  <p className="text-base font-bold text-amber-900 mb-3">
                    이 분석 결과는 변호사·노무사의 법률 자문을 대체하지 않습니다.
                  </p>
                  <p className="text-sm text-amber-800 leading-relaxed">
                    공개된 법령·표준계약·가이드 문서를 바탕으로, 사용자가 계약 내용을 이해하기 쉽도록 정리해 주는 도구입니다.
                    <br />
                    실제 소송, 분쟁 대응, 합의 등은 반드시 전문가의 도움을 받으셔야 합니다.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
