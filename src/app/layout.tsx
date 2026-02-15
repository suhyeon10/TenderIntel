import type { Metadata } from 'next'
import { Noto_Sans_KR } from 'next/font/google'
import './global.css'
import { Toaster } from '@/components/ui/toaster'
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Analytics } from "@vercel/analytics/next"
export const metadata: Metadata = {
  title: 'LINKUS - 프리랜서를 연결하는 초고속 서비스 제작 플랫폼',
  description: '프리랜서 개발자와 기업을 연결하는 초고속 서비스 제작 플랫폼. 견적은 무료, 연락처 확인할 때만 결제하세요.',
  keywords: ['프리랜서', '프로젝트 매칭', '서비스 제작', 'MVP 개발', 'LINKUS', '개발자 매칭'],
  openGraph: {
    title: 'LINKUS - 프리랜서를 연결하는 플랫폼',
    description: '프리랜서 개발자와 기업을 연결하는 초고속 서비스 제작 플랫폼',
    type: 'website',
  },
  // Next.js 13+ App Router에서는 app/icon.svg를 자동으로 인식하므로 명시적 설정 불필요
  // icons 설정을 제거하면 app/icon.svg가 자동으로 사용됩니다
}

const notoSansKR = Noto_Sans_KR({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-noto-sans-kr',
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${notoSansKR.className} antialiased`}>
        {children}
        <SpeedInsights />
        <Analytics />
        <Toaster />
      </body>
    </html>
  )
}
