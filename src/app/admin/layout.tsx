// TODO: Admin auth guard 추가
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import AdminNav from './admin-nav'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />
      <main>{children}</main>
    </div>
  )
}

