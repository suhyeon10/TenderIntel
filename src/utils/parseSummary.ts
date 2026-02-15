/**
 * 상황분석 리포트의 summary 마크다운을 섹션별로 파싱하는 유틸리티
 */

export type SummarySection = {
  title: string
  content: string
}

/**
 * summary 마크다운 텍스트를 섹션 배열로 파싱
 * 
 * @param summary 마크다운 형식의 summary 텍스트 (## 헤더 또는 이모지로 섹션 구분)
 * @returns 파싱된 섹션 배열
 */
export function parseSummary(summary: string): SummarySection[] {
  if (!summary || !summary.trim()) {
    return []
  }

  const lines = summary.split('\n')
  const sections: SummarySection[] = []
  let current: SummarySection | null = null

  // 이모지 감지 함수 (유니코드 범위를 올바르게 처리)
  const isEmojiStart = (text: string): boolean => {
    if (!text || text.length === 0) return false
    const firstChar = text[0]
    const codePoint = firstChar.codePointAt(0) || 0
    // 이모지 유니코드 범위들
    return (
      (codePoint >= 0x1F300 && codePoint <= 0x1F9FF) || // Miscellaneous Symbols and Pictographs
      (codePoint >= 0x2600 && codePoint <= 0x26FF) ||   // Miscellaneous Symbols
      (codePoint >= 0x2700 && codePoint <= 0x27BF) ||   // Dingbats
      (codePoint >= 0x1F600 && codePoint <= 0x1F64F) || // Emoticons
      (codePoint >= 0x1F900 && codePoint <= 0x1F9FF)    // Supplemental Symbols and Pictographs
    )
  }

  // 이모지로 시작하는 섹션 패턴들
  // 형식 1: 📊 **상황 분석**: "내용"
  // 형식 2: 📊 **상황 분석**: 내용 (따옴표 없음)
  // 형식 3: 📊 상황 분석: 내용
  // 유니코드 속성 이스케이프 사용 (더 안전한 방법)
  const emojiSectionPattern1 = /^(\p{Emoji})\s*\*\*(.+?)\*\*:\s*["']?(.+?)["']?\.?$/u
  const emojiSectionPattern2 = /^(\p{Emoji})\s*(.+?):\s*["']?(.+?)["']?\.?$/u

  for (const raw of lines) {
    const line = raw.trim()
    
    // 빈 줄은 건너뛰기
    if (!line) {
      if (current) {
        // 빈 줄도 content에 포함 (마크다운 포맷 유지)
        current.content += '\n'
      }
      continue
    }

    // 새 섹션 시작 감지
    let sectionTitle: string | null = null
    let sectionContent: string | null = null

    // 1. 이모지 + **볼드** 형식 (예: 📊 **상황 분석**: "내용")
    const emojiMatch1 = line.match(emojiSectionPattern1)
    if (emojiMatch1) {
      const emoji = emojiMatch1[1]
      const title = emojiMatch1[2].trim().replace(/\*\*/g, '') // ** 제거
      const content = emojiMatch1[3].trim()
      
      sectionTitle = `${emoji} ${title}`
      sectionContent = content.replace(/^["']|["']\.?$/g, '').trim() // 따옴표 제거
    }
    // 2. 이모지 + 일반 텍스트 형식 (예: 📊 상황 분석: 내용)
    else {
      const emojiMatch2 = line.match(emojiSectionPattern2)
      if (emojiMatch2) {
        const emoji = emojiMatch2[1]
        const title = emojiMatch2[2].trim()
        const content = emojiMatch2[3]?.trim() || ''
        
        sectionTitle = `${emoji} ${title}`
        sectionContent = content.replace(/^["']|["']\.?$/g, '').trim() // 따옴표 제거
      }
      // 3. ## 헤더 형식
      else if (line.startsWith('## ')) {
        sectionTitle = line.replace(/^##\s*/, '').trim().replace(/\*\*/g, '') // ** 제거
        sectionContent = null
      }
      // 4. 이모지로 시작하는 줄 (제목만 있는 경우) - 함수 사용
      else if (isEmojiStart(line)) {
        // 이모지로 시작하는 줄을 제목으로 처리
        sectionTitle = line.replace(/\*\*/g, '') // ** 제거
        sectionContent = null
      }
    }

    // 새 섹션 시작
    if (sectionTitle !== null) {
      // 이전 섹션 저장
      if (current) {
        sections.push({
          ...current,
          content: current.content.trim(),
        })
      }
      
      // 새 섹션 시작
      current = {
        title: sectionTitle,
        content: sectionContent || '',
      }
    } else if (current) {
      // 현재 섹션에 내용 추가
      current.content += (current.content ? '\n' : '') + line
    }
  }

  // 마지막 섹션 저장
  if (current) {
    sections.push({
      ...current,
      content: current.content.trim(),
    })
  }

  return sections
}

/**
 * 이모지로 섹션 찾기 (헬퍼 함수)
 * 
 * @param sections 파싱된 섹션 배열
 * @param emoji 찾을 이모지 (예: '📊', '⚖️', '🎯', '💬')
 * @returns 해당 이모지로 시작하는 섹션 또는 undefined
 */
export function findSectionByEmoji(sections: SummarySection[], emoji: string): SummarySection | undefined {
  return sections.find(s => s.title.startsWith(emoji))
}

/**
 * 섹션 제목에서 이모지 제거하고 텍스트만 반환
 * 
 * @param title 섹션 제목 (예: "📊 상황 분석의 결과")
 * @returns 이모지 제거된 텍스트 (예: "상황 분석의 결과")
 */
export function removeEmojiFromTitle(title: string): string {
  // 유니코드 속성 이스케이프 사용
  return title.replace(/^\p{Emoji}\s*/u, '').trim()
}

