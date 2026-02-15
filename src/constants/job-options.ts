// 공통 직무 및 전문분야 옵션 정의

export interface JobCategory {
  category: string
  jobs: readonly string[]
  allowCustomSpecialty?: boolean
}

export const OTHER_CATEGORY_LABEL = '기타'

export const JOB_CATEGORIES: readonly JobCategory[] = [
  {
    category: '개발',
    jobs: [
      '프론트엔드 개발',
      '백엔드 개발 (서버 개발)',
      '풀스택 개발',
      '모바일 (iOS)',
      '모바일 (Android)',
      '모바일 (크로스플랫폼)',
      'DevOps / 인프라',
      'QA / 테스팅',
      '게임 개발',
      '블록체인',
    ],
  },
  {
    category: '디자인',
    jobs: [
      'UX/UI 디자인 (앱/웹)',
      '프로덕트 디자인',
      '브랜드 디자인 (BI/CI)',
      '그래픽 디자인 (광고, 상세페이지 등)',
      '일러스트 / 캐릭터',
      '3D / 모션 그래픽',
    ],
  },
  {
    category: '기획/PM',
    jobs: [
      '서비스 기획 (웹/앱)',
      '프로덕트 매니저 (PM)',
      '프로젝트 매니저 (PM/PL)',
      '프로덕트 오너 (PO)',
      '비즈니스 분석 (BA)',
    ],
  },
  {
    category: '데이터',
    jobs: [
      '데이터 분석 (Data Analysis)',
      '데이터 엔지니어링 (DE)',
      '데이터 사이언스 (DS)',
      'AI / 머신러닝 (ML)',
      '데이터베이스 관리 (DBA)',
      '데이터 시각화',
    ],
  },
  {
    category: '마케팅/광고',
    jobs: [
      '퍼포먼스 마케팅 (광고 운영)',
      '콘텐츠 마케팅',
      '검색 엔진 최적화 (SEO)',
      '소셜 미디어 (SNS) 마케팅',
      '브랜드 마케팅',
      '그로스 해킹 (GH)',
    ],
  },
  {
    category: '콘텐츠/미디어',
    jobs: [
      '카피라이팅 / 콘텐츠 작성',
      '영상 편집 / 제작',
      '사진 촬영',
      '번역 / 통역',
      '오디오 / 팟캐스트',
    ],
  },
  {
    category: '경영 지원/컨설팅',
    jobs: [
      '전략 / 경영 컨설팅',
      '영업 / B2B',
      '재무 / 회계',
      '인사 (HR) / 채용',
      '법률 자문',
      '고객 서비스 (CS)',
    ],
  },
  {
    category: OTHER_CATEGORY_LABEL,
    jobs: [],
    allowCustomSpecialty: true,
  },
] as const

export const MAX_MAIN_JOB_SELECTION = 2

// 플랫한 직무 목록 (프로필 업데이트용) - 중복 제거
export const JOB_OPTIONS: string[] = Array.from(
  new Set(JOB_CATEGORIES.flatMap((cat) => cat.jobs))
)

// 전문분야 옵션 (전체 목록)
export const EXPERTISE_OPTIONS: string[] = JOB_OPTIONS

export const SPECIALTY_OPTIONS_BY_CATEGORY: Record<string, readonly string[]> =
  JOB_CATEGORIES.reduce((acc, category) => {
    acc[category.category] = category.jobs
    return acc
  }, {} as Record<string, readonly string[]>)

export const SPECIALTY_TO_CATEGORY_MAP: Record<string, string> =
  JOB_CATEGORIES.reduce((acc, category) => {
    category.jobs.forEach((job) => {
      acc[job] = category.category
    })
    return acc
  }, {} as Record<string, string>)

export const CATEGORY_ALLOW_CUSTOM_SPECIALTY: Record<string, boolean> =
  JOB_CATEGORIES.reduce((acc, category) => {
    acc[category.category] = Boolean(category.allowCustomSpecialty)
    return acc
  }, {} as Record<string, boolean>)

