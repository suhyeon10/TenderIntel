/**
 * 포트원 V2 정기 결제 서비스
 * 첫 달 무료 + 월 정기 결제 구현
 * 
 * 서버 사이드 전용 - 클라이언트에서 import하지 마세요!
 */

import 'server-only' // 서버 사이드에서만 실행되도록 보호
import { PortOneClient, PaymentClient, BillingKeyClient } from '@portone/server-sdk'
import { Webhook } from '@portone/server-sdk'

// 포트원 V2 클라이언트 생성
// 서버 사이드에서만 실행되도록 함수로 래핑
export function getPortOneClients() {
  const PORTONE_API_SECRET = process.env.PORTONE_V2_API_SECRET || ''

  if (!PORTONE_API_SECRET) {
    // 서버 사이드에서만 실행되므로 에러를 throw
    if (typeof window === 'undefined') {
      throw new Error('PORTONE_V2_API_SECRET이 설정되지 않았습니다.')
    }
    // 클라이언트 사이드에서는 경고만 출력 (이 코드는 실행되지 않아야 함)
    console.warn('PORTONE_V2_API_SECRET이 설정되지 않았습니다.')
  }

  return {
    portoneClient: PortOneClient({ secret: PORTONE_API_SECRET }),
    paymentClient: PaymentClient({ secret: PORTONE_API_SECRET }),
    billingKeyClient: BillingKeyClient({ secret: PORTONE_API_SECRET }),
  }
}

// 클라이언트를 지연 초기화 (서버 사이드에서만 사용)
// 클라이언트 사이드에서 이 파일이 import되면 에러 발생 방지
function getPaymentClient() {
  if (typeof window !== 'undefined') {
    throw new Error('이 함수는 서버 사이드에서만 사용할 수 있습니다.')
  }
  return getPortOneClients().paymentClient
}

function getBillingKeyClient() {
  if (typeof window !== 'undefined') {
    throw new Error('이 함수는 서버 사이드에서만 사용할 수 있습니다.')
  }
  return getPortOneClients().billingKeyClient
}

/**
 * 빌링키 ID 생성
 * @deprecated 이 함수는 src/utils/billing-key.ts로 이동했습니다.
 * 서버 사이드에서만 사용하는 경우 이 함수를 사용해도 되지만,
 * 클라이언트 사이드에서 사용하는 경우 src/utils/billing-key.ts를 사용하세요.
 */
export function generateBillingKeyId(userId: string): string {
  return `linkers_${userId}_${Date.now()}`
}

/**
 * 빌링키로 즉시 결제 요청
 */
export async function requestPaymentWithBillingKey(
  billingKey: string,
  paymentId: string,
  amount: number,
  orderName: string,
  customer: {
    name?: string
    email?: string
    phoneNumber?: string
  }
) {
  if (typeof window !== 'undefined') {
    throw new Error('이 함수는 서버 사이드에서만 사용할 수 있습니다.')
  }
  
  const paymentClient = getPaymentClient()
  try {
    const payment = await paymentClient.payWithBillingKey({
      paymentId,
      billingKey,
      orderName,
      customer: {
        name: customer.name ? { full: customer.name } : undefined,
        email: customer.email || undefined,
        phoneNumber: customer.phoneNumber && customer.phoneNumber.trim() !== '' 
          ? customer.phoneNumber 
          : '010-0000-0000', // 필수 필드이므로 기본값 제공
      },
      amount: {
        total: amount,
      },
      currency: 'KRW',
    })

    return payment
  } catch (error: any) {
    throw new Error(`결제 요청 실패: ${error.message || '알 수 없는 오류'}`)
  }
}

/**
 * 결제 예약 (월 정기 결제)
 * 빌링키 발급 직후 바로 사용할 경우 재시도 로직 포함
 */
export async function scheduleMonthlyPayment(
  billingKey: string,
  paymentId: string,
  scheduledAt: string, // ISO 8601 형식 (예: "2024-12-25T00:00:00Z")
  amount: number,
  orderName: string,
  customer: {
    name?: string
    email?: string
    phoneNumber?: string
  },
  retryCount: number = 10, // 재시도 횟수 증가 (빌링키 반영 시간 고려)
  retryDelay: number = 3000 // 재시도 간격 증가 (3초)
) {
  // 서버 사이드에서만 실행
  if (typeof window !== 'undefined') {
    throw new Error('이 함수는 서버 사이드에서만 사용할 수 있습니다.')
  }
  
  const paymentClient = getPaymentClient()
  let lastError: any = null
  
  for (let attempt = 1; attempt <= retryCount; attempt++) {
    try {
      if (attempt > 1) {
        // 재시도 간격: 3초, 6초, 9초, 12초, 15초... (선형 증가)
        // 빌링키 발급 직후 포트원 서버 반영 시간을 고려하여 충분한 대기
        const delay = retryDelay * attempt
        console.log(`결제 예약 재시도 (${attempt}/${retryCount})... ${delay}ms 대기`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
      
      console.log('결제 예약 요청:', {
        paymentId,
        timeToPay: scheduledAt,
        billingKey: billingKey.substring(0, 10) + '...',
        amount,
        orderName,
        attempt,
        customer: {
          name: customer.name,
          email: customer.email,
          phoneNumber: customer.phoneNumber,
        },
      })

      const scheduledPayment = await paymentClient.paymentSchedule.createPaymentSchedule({
        paymentId,
        timeToPay: scheduledAt,
        payment: {
          billingKey,
          orderName,
          customer: {
            name: customer.name ? { full: customer.name } : undefined,
            email: customer.email || undefined,
            phoneNumber: customer.phoneNumber && customer.phoneNumber.trim() !== '' 
              ? customer.phoneNumber 
              : '010-0000-0000', // 필수 필드이므로 기본값 제공
          },
          amount: {
            total: amount,
          },
          currency: 'KRW',
        },
      })

      console.log('결제 예약 성공:', {
        paymentId,
        scheduleId: (scheduledPayment as any).scheduleId || (scheduledPayment as any).id,
        scheduledPayment,
      })
      return scheduledPayment
    } catch (error: any) {
      lastError = error
      const errorData = error.data || error.response?.data
      
      // BILLING_KEY_NOT_FOUND 에러이고 재시도 가능하면 계속 시도
      if (errorData?.type === 'BILLING_KEY_NOT_FOUND' && attempt < retryCount) {
        console.warn(`빌링키를 찾을 수 없음 (시도 ${attempt}/${retryCount}), 재시도 중...`)
        continue
      }
      
      // 재시도 불가능한 에러이거나 마지막 시도면 에러 던지기
      if (attempt === retryCount || errorData?.type !== 'BILLING_KEY_NOT_FOUND') {
        throw error
      }
    }
  }
  
  // 모든 재시도 실패 - 에러 처리
  const errorData = lastError?.data || lastError?.response?.data
  
  console.error('결제 예약 실패 상세:', {
    errorType: errorData?.type,
    errorMessage: errorData?.message || lastError?.message,
    errorData: errorData,
    billingKey: billingKey.substring(0, 20) + '...',
    attempts: retryCount,
  })
  
  // 에러 타입별 메시지 처리
  let errorMessage = '알 수 없는 오류'
  
  if (errorData?.type === 'BILLING_KEY_NOT_FOUND') {
    errorMessage = '빌링키를 찾을 수 없습니다. 빌링키 발급 후 잠시 기다린 후 다시 시도해주세요.'
  } else if (errorData?.type) {
    errorMessage = `포트원 API 오류: ${errorData.type}${errorData.message ? ` - ${errorData.message}` : ''}`
  } else if (errorData?.message) {
    errorMessage = errorData.message
  } else if (lastError?.message) {
    errorMessage = lastError.message
  }
  
  throw new Error(`결제 예약 실패: ${errorMessage}`)
}

/**
 * 결제 예약 취소
 * @param scheduleId - 결제 예약 ID (subscriptions 테이블의 portone_schedule_id)
 */
export async function unschedulePayment(scheduleId: string): Promise<void> {
  // 서버 사이드에서만 실행
  if (typeof window !== 'undefined') {
    throw new Error('이 함수는 서버 사이드에서만 사용할 수 있습니다.')
  }
  
  const paymentClient = getPaymentClient()
  try {
    console.log('결제 예약 취소 요청:', { scheduleId })
    
    await paymentClient.paymentSchedule.revokePaymentSchedules({
      scheduleIds: [scheduleId],
    })
    
    console.log('결제 예약 취소 성공:', { scheduleId })
  } catch (error: any) {
    const errorData = error.data || error.response?.data
    console.error('결제 예약 취소 실패:', {
      scheduleId,
      errorType: errorData?.type,
      errorMessage: errorData?.message || error.message,
    })
    throw new Error(`결제 예약 취소 실패: ${errorData?.message || error.message || '알 수 없는 오류'}`)
  }
}

/**
 * 결제 정보 조회
 */
export async function getPayment(paymentId: string) {
  // 서버 사이드에서만 실행
  if (typeof window !== 'undefined') {
    throw new Error('이 함수는 서버 사이드에서만 사용할 수 있습니다.')
  }
  
  const paymentClient = getPaymentClient()
  try {
    const payment = await paymentClient.getPayment({ paymentId })
    return payment
  } catch (error: any) {
    throw new Error(`결제 정보 조회 실패: ${error.message || '알 수 없는 오류'}`)
  }
}

/**
 * 빌링키 정보 조회
 */
export async function getBillingKey(billingKey: string) {
  // 서버 사이드에서만 실행
  if (typeof window !== 'undefined') {
    throw new Error('이 함수는 서버 사이드에서만 사용할 수 있습니다.')
  }
  
  const billingKeyClient = getBillingKeyClient()
  try {
    const billingKeyInfo = await billingKeyClient.getBillingKeyInfo({ billingKey })
    return billingKeyInfo
  } catch (error: any) {
    throw new Error(`빌링키 조회 실패: ${error.message || '알 수 없는 오류'}`)
  }
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
 * 다음 달 결제일을 ISO 8601 형식으로 변환
 */
export function getNextBillingDateISO(
  subscriptionDate: Date,
  isFirstMonth: boolean
): string {
  const nextDate = calculateNextBillingDate(subscriptionDate, isFirstMonth)
  return nextDate.toISOString()
}

/**
 * Webhook 검증
 */
export async function verifyWebhook(
  webhookSecret: string,
  payload: string,
  headers: Record<string, string>
) {
  try {
    const webhook = await Webhook.verify(webhookSecret, payload, headers)
    return webhook
  } catch (error: any) {
    if (error instanceof Webhook.WebhookVerificationError) {
      throw new Error('Webhook 검증 실패')
    }
    throw error
  }
}

