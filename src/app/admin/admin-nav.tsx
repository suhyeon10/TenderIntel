'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

export default function AdminNav() {
  const pathname = usePathname()

  const navItems = [
    {
      label: '계약서 분석',
      href: '/admin/contracts',
    },
    {
      label: '법령 청크',
      href: '/admin/legal',
    },
  ]

  return (
    <div className="bg-white border-b border-gray-200 shadow-sm">
      <div className="container mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-1">
            <Link href="/admin" className="text-xl font-bold text-gray-900">
              Admin
            </Link>
            <span className="text-gray-400">/</span>
          </div>
          <nav className="flex gap-1">
            {navItems.map((item) => {
              const isActive = pathname?.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'px-4 py-2 text-sm font-medium rounded-md transition-colors',
                    isActive
                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  )}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </div>
      </div>
    </div>
  )
}

