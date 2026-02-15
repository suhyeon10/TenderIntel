export const MAJOR_OPTIONS = [
  '컴퓨터 공학',
  '컴퓨터 과학',
  '소프트웨어 공학',
  '정보통신공학',
  '데이터 과학',
  '인공지능',
  '전기전자공학',
  '기계공학',
  '산업공학',
  '화학공학',
  '재료공학',
  '건축공학',
  '토목공학',
  '경영학',
  '경제학',
  '회계학',
  '마케팅',
  '국제경영',
  '심리학',
  '사회학',
  '교육학',
  '수학',
  '물리학',
  '화학',
  '생명과학',
  '간호학',
  '의학',
  '약학',
  '디자인학',
  '시각디자인',
  '제품디자인',
  '패션디자인',
  '미디어학',
  '언론정보학',
  '커뮤니케이션학',
  '국문학',
  '영문학',
  '국제학',
  '정치외교학',
]

export const parseMajorContent = (content?: string | null): string[] => {
  if (!content) return []

  return content
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

export const formatMajorsForStorage = (majors: string[]): string | null => {
  const sanitized = majors.map((major) => major.trim()).filter(Boolean)

  if (sanitized.length === 0) {
    return null
  }

  return sanitized.join(', ')
}
