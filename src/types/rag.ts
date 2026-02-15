/**
 * RAG 시스템 타입 정의
 */

export interface Doc {
  id: number
  source: 'narajangter' | 'ntis' | 'pdf' | 'internal'
  doc_url?: string
  title?: string
  project_code?: string
  published_at?: string
  raw_text?: string
  created_at: string
  created_by?: string
}

export interface DocChunk {
  id: number
  doc_id: number
  chunk_index: number
  text: string
  meta: Record<string, any>
  embedding?: number[]
  created_at: string
}

export interface TeamEmbedding {
  team_id: number
  summary: string
  meta: Record<string, any>
  embedding?: number[]
  updated_at: string
}

export interface IngestRequest {
  file?: File
  source: 'narajangter' | 'ntis' | 'pdf' | 'internal'
  title?: string
  publishedAt?: string
  docUrl?: string
}

export interface IngestResponse {
  docId: number
  chunks: number
}

export interface QueryRequest {
  mode: 'summary' | 'estimate' | 'match' | 'custom'
  query: string
  topK?: number
  withTeams?: boolean
  docIds?: number[]
}

export interface UsedChunk {
  id: number
  doc_id: number
  score: number
}

export interface MatchedTeam {
  team_id: number
  score: number
  reason?: string
}

export interface QueryResponse {
  answer: string
  markdown?: string  // 마크다운 형식 (다운로드용)
  usedChunks: UsedChunk[]
  teams?: MatchedTeam[]
  query?: string
  format?: string
}

export interface TeamUpdateRequest {
  teamId: number
  summary: string
  meta: Record<string, any>
}

export interface AnnouncementMetadata {
  projectName: string
  budget?: {
    min?: number
    max?: number
    currency?: string
  }
  duration?: {
    months?: number
  }
  techStack?: string[]
  organization?: string
  deadline?: string
}

export interface SearchFilters {
  budgetMin?: number
  budgetMax?: number
  techStack?: string[]
  region?: string
}

export interface AnalysisResult {
  requirements: {
    essential_skills: string[]
    preferred_skills: string[]
    team_size: number
    difficulty: number
  }
  similar_bids: Array<{
    announcement_id: string
    similarity: number
    budget?: number
  }>
  risk_analysis: {
    difficulty: number
    schedule_risk: string
    budget_risk: string
    team_risk: string
  }
  estimated_effort: {
    frontend: number
    backend: number
    devops: number
    total: number
    team_size: number
  }
}

export interface EstimateDocument {
  team_id: string
  content: string
  created_at: string
}

