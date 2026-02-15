'use client'

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white mt-auto">
      <div className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 className="font-semibold mb-4">Linkus Public</h3>
            <p className="text-sm text-slate-600">
              공공 프로젝트 AI 견적 자동화 플랫폼
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-4">문의</h3>
            <p className="text-sm text-slate-600">
              support@linkus.co.kr
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-4">안내</h3>
            <p className="text-sm text-slate-600 mb-2">
              모든 AI 생성 내용은 <strong>[id:###]</strong> 형식으로 근거를 표기합니다.
            </p>
            <p className="text-sm text-slate-600">
              <a href="#" className="text-blue-600 hover:underline">
                개인정보처리방침
              </a>
              {' · '}
              <a href="#" className="text-blue-600 hover:underline">
                보안 정책
              </a>
            </p>
          </div>
        </div>
        <div className="mt-8 pt-8 border-t border-slate-200 text-center text-sm text-slate-500">
          © 2024 Linkus Public. All rights reserved.
        </div>
      </div>
    </footer>
  )
}

