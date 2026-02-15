/**
 * Contract 컴포넌트 공통 디자인 토큰
 * UI 일관성을 위한 색상, 스타일, 라벨 정의
 */

export type Severity = 'high' | 'medium' | 'low'

// 위험도 색상 정의
export const SEVERITY_COLORS = {
  high: {
    bg: 'bg-red-50',
    bgHover: 'bg-red-100',
    border: 'border-red-200',
    borderHover: 'border-red-300',
    text: 'text-red-700',
    textDark: 'text-red-600',
    gradient: 'from-red-500 to-rose-500',
    solid: 'bg-red-500',
    badge: 'bg-red-100 text-red-800 border-red-300',
  },
  medium: {
    bg: 'bg-amber-50',
    bgHover: 'bg-amber-100',
    border: 'border-amber-200',
    borderHover: 'border-amber-300',
    text: 'text-amber-700',
    textDark: 'text-amber-600',
    gradient: 'from-amber-500 to-orange-500',
    solid: 'bg-amber-500',
    badge: 'bg-amber-100 text-amber-800 border-amber-300',
  },
  low: {
    bg: 'bg-green-50',
    bgHover: 'bg-green-100',
    border: 'border-green-200',
    borderHover: 'border-green-300',
    text: 'text-green-700',
    textDark: 'text-green-600',
    gradient: 'from-green-500 to-emerald-500',
    solid: 'bg-green-500',
    badge: 'bg-green-100 text-green-800 border-green-300',
  },
} as const

// 위험도 라벨 (통일)
export const SEVERITY_LABELS: Record<Severity, string> = {
  high: '위험 높음',
  medium: '주의',
  low: '위험 낮음',
}

// 위험도 라벨 (짧은 버전)
export const SEVERITY_LABELS_SHORT: Record<Severity, string> = {
  high: 'HIGH',
  medium: 'MEDIUM',
  low: 'LOW',
}

// 위험도 점수 기준
export const RISK_SCORE_THRESHOLDS = {
  low: 39, // 0-39: 위험 낮음
  medium: 69, // 40-69: 주의
  high: 100, // 70-100: 위험 높음
} as const

// 위험도 점수로 severity 계산
export function getSeverityFromScore(score: number): Severity {
  if (score <= RISK_SCORE_THRESHOLDS.low) return 'low'
  if (score <= RISK_SCORE_THRESHOLDS.medium) return 'medium'
  return 'high'
}

// Primary 버튼 그라데이션 (통일)
export const PRIMARY_GRADIENT = 'bg-gradient-to-r from-blue-600 to-indigo-600'
export const PRIMARY_GRADIENT_HOVER = 'hover:from-blue-700 hover:to-indigo-700'

// 아이콘 크기
export const ICON_SIZES = {
  xs: 'w-2 h-2',
  sm: 'w-3 h-3',
  md: 'w-4 h-4',
  lg: 'w-5 h-5',
  xl: 'w-6 h-6',
} as const

// 포커스 스타일 (통일)
export const FOCUS_STYLE = 'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'

// 카드 border-radius
export const CARD_RADIUS = {
  sm: 'rounded-lg',
  md: 'rounded-xl',
  lg: 'rounded-2xl',
} as const

// 모달 오버레이
export const MODAL_OVERLAY = 'fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4'

