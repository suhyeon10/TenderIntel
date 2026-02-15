/**
 * 빌링키 ID 생성 유틸리티
 * 클라이언트/서버 양쪽에서 사용 가능
 */

export function generateBillingKeyId(userId: string): string {
  return `linkers_${userId}_${Date.now()}`
}

