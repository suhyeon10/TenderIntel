// TODO: Admin auth guard 추가
import Link from 'next/link'

export default function AdminPage() {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Admin 대시보드</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link
          href="/admin/contracts"
          className="p-6 bg-white border border-gray-300 rounded-lg hover:shadow-md transition-shadow"
        >
          <h2 className="text-xl font-semibold mb-2">계약서 분석</h2>
          <p className="text-gray-600">
            계약서 분석 결과를 확인하고 RAG/청킹/이슈를 점검합니다.
          </p>
        </Link>
        <Link
          href="/admin/legal"
          className="p-6 bg-white border border-gray-300 rounded-lg hover:shadow-md transition-shadow"
        >
          <h2 className="text-xl font-semibold mb-2">법령 청크</h2>
          <p className="text-gray-600">
            법령 청크 데이터를 확인하고 수정합니다.
          </p>
        </Link>
      </div>
    </div>
  )
}

