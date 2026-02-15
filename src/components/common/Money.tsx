'use client'

interface MoneyProps {
  amount: number
  currency?: string
  showSymbol?: boolean
}

export function Money({
  amount,
  currency = 'KRW',
  showSymbol = true,
}: MoneyProps) {
  const formatAmount = (amount: number): string => {
    if (amount >= 100000000) {
      // 억 단위
      const eok = Math.floor(amount / 100000000)
      const man = Math.floor((amount % 100000000) / 10000)
      if (man > 0) {
        return `${eok}억 ${man}만원`
      }
      return `${eok}억원`
    } else if (amount >= 10000) {
      // 만 단위
      const man = Math.floor(amount / 10000)
      return `${man}만원`
    } else {
      return `${amount.toLocaleString()}원`
    }
  }

  return (
    <span className="font-semibold">
      {showSymbol && currency === 'KRW' && '₩'}
      {formatAmount(amount)}
    </span>
  )
}

