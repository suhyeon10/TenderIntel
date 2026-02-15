/**
 * 포트원 정기 결제 서비스
 * 첫 달 무료 + 월 정기 결제 구현
 */

const PORTONE_API_BASE = 'https://api.iamport.kr'
const PORTONE_REST_API_KEY = process.env.NEXT_PUBLIC_PORTONE_REST_API_KEY || ''
const PORTONE_REST_API_SECRET = process.env.PORTONE_REST_API_SECRET || ''

interface PortOneTokenResponse {
  code: number
  message: string
  response: {
    access_token: string
    expired_at: number
    now: number
  }
}

interface PortOneBillingKeyResponse {
  code: number
  message: string
  response: {
    customer_uid: string
    card_name: string
    card_code: string
    card_number: string
  }
}

interface PortOnePaymentResponse {
  code: number
  message: string
  response: {
    imp_uid: string
    merchant_uid: string
    amount: number
    status: string
    paid_at: number
  }
}

interface PortOneScheduleResponse {
  code: number
  message: string
  response: Array<{
    merchant_uid: string
    schedule_at: number
    amount: number
    name: string
  }>
}

/**
 * 포트원 Access Token 발급
 */
async function getPortOneAccessToken(): Promise<string> {
  const response = await fetch(`${PORTONE_API_BASE}/users/getToken`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      imp_key: PORTONE_REST_API_KEY,
      imp_secret: PORTONE_REST_API_SECRET,
    }),
  })

  const data: PortOneTokenResponse = await response.json()

  if (data.code !== 0) {
    throw new Error(`포트원 토큰 발급 실패: ${data.message}`)
  }

  return data.response.access_token
}

/**
 * 빌링키 발급 (결제창 방식)
 * 프론트엔드에서 IMP.request_pay()로 처리하므로 여기서는 customer_uid만 생성
 */
export function generateCustomerUid(userId: string): string {
  return `linkers_${userId}_${Date.now()}`
}

/**
 * 빌링키로 즉시 결제 요청
 */
export async function requestPaymentWithBillingKey(
  customerUid: string,
  merchantUid: string,
  amount: number,
  name: string,
  buyerInfo: {
    name: string
    email: string
    tel: string
  }
): Promise<PortOnePaymentResponse['response']> {
  const accessToken = await getPortOneAccessToken()

  const response = await fetch(`${PORTONE_API_BASE}/subscribe/payments/again`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      customer_uid: customerUid,
      merchant_uid: merchantUid,
      amount: {
        total: amount,
      },
      currency: 'KRW',
      name,
      buyer_name: buyerInfo.name,
      buyer_email: buyerInfo.email,
      buyer_tel: buyerInfo.tel,
    }),
  })

  const data: PortOnePaymentResponse = await response.json()

  if (data.code !== 0) {
    throw new Error(`결제 요청 실패: ${data.message}`)
  }

  return data.response
}

/**
 * 결제 예약 (월 정기 결제)
 */
export async function scheduleMonthlyPayment(
  customerUid: string,
  merchantUid: string,
  scheduleAt: number, // Unix timestamp
  amount: number,
  name: string,
  buyerInfo: {
    name: string
    email: string
    tel: string
  }
): Promise<PortOneScheduleResponse['response']> {
  const accessToken = await getPortOneAccessToken()

  const response = await fetch(`${PORTONE_API_BASE}/subscribe/payments/schedule`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      customer_uid: customerUid,
      schedules: [
        {
          merchant_uid: merchantUid,
          schedule_at: scheduleAt,
          amount: {
            total: amount,
          },
          currency: 'KRW',
          name,
          buyer_name: buyerInfo.name,
          buyer_email: buyerInfo.email,
          buyer_tel: buyerInfo.tel,
        },
      ],
    }),
  })

  const data: PortOneScheduleResponse = await response.json()

  if (data.code !== 0) {
    throw new Error(`결제 예약 실패: ${data.message}`)
  }

  return data.response
}

/**
 * 결제 예약 취소
 */
export async function unschedulePayment(merchantUid: string): Promise<void> {
  const accessToken = await getPortOneAccessToken()

  const response = await fetch(`${PORTONE_API_BASE}/subscribe/payments/unschedule`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      merchant_uid: merchantUid,
    }),
  })

  const data = await response.json()

  if (data.code !== 0) {
    throw new Error(`결제 예약 취소 실패: ${data.message}`)
  }
}

/**
 * 결제 정보 조회
 */
export async function getPayment(impUid: string): Promise<PortOnePaymentResponse['response']> {
  const accessToken = await getPortOneAccessToken()

  const response = await fetch(`${PORTONE_API_BASE}/payments/${impUid}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  const data: PortOnePaymentResponse = await response.json()

  if (data.code !== 0) {
    throw new Error(`결제 정보 조회 실패: ${data.message}`)
  }

  return data.response
}

/**
 * 다음 달 결제일 계산 (첫 달 무료 고려)
 */
export function calculateNextBillingDate(
  subscriptionDate: Date,
  isFirstMonth: boolean
): Date {
  const nextDate = new Date(subscriptionDate)
  
  if (isFirstMonth) {
    // 첫 달이면 30일 후 (무료 기간)
    nextDate.setDate(nextDate.getDate() + 30)
  } else {
    // 이후에는 매월 같은 날짜
    nextDate.setMonth(nextDate.getMonth() + 1)
  }
  
  return nextDate
}

/**
 * 다음 달 결제일을 Unix timestamp로 변환
 */
export function getNextBillingTimestamp(
  subscriptionDate: Date,
  isFirstMonth: boolean
): number {
  const nextDate = calculateNextBillingDate(subscriptionDate, isFirstMonth)
  return Math.floor(nextDate.getTime() / 1000)
}

/**
 * 하위 상점(Tier) 정보 조회
 */
export interface TierInfo {
  tier_code: string
  tier_name: string
}

export async function getTier(tierCode: string): Promise<TierInfo> {
  const accessToken = await getPortOneAccessToken()

  const response = await fetch(`${PORTONE_API_BASE}/tiers/${tierCode}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  const data = await response.json()

  if (data.code !== 0) {
    throw new Error(`하위 상점 조회 실패: ${data.message}`)
  }

  return data.response
}

/**
 * 하위 상점 목록 조회 (포트원 콘솔에서 확인 필요)
 * 참고: 포트원 V1 API에는 하위 상점 목록 조회 API가 없을 수 있습니다.
 * 포트원 콘솔 또는 MCP 도구를 통해 조회하세요.
 */

