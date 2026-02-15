'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { FileText, MessageSquare, BookOpen, Home, Scale, UserCircle, LogOut, Menu, X, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useState, useEffect, useRef } from 'react'
import { createSupabaseBrowserClient } from '@/supabase/supabase-client'
import { User as SupabaseUser } from '@supabase/supabase-js'

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // 클라이언트에서만 Supabase 클라이언트 생성
    if (typeof window === 'undefined') return

    const supabase = createSupabaseBrowserClient()

    const getUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        setUser(user)
      } catch (error) {
        console.error('사용자 정보 조회 실패:', error)
        setUser(null)
      }
    }

    getUser()

    // 인증 상태 변경 감지
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  // 외부 클릭 시 사용자 메뉴 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false)
      }
    }

    if (userMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [userMenuOpen])

  const handleLogout = async () => {
    try {
      if (typeof window === 'undefined') return
      const supabase = createSupabaseBrowserClient()
      await supabase.auth.signOut()
      setUser(null)
      setUserMenuOpen(false)
      router.push('/legal')
    } catch (error) {
      console.error('로그아웃 실패:', error)
    }
  }

  const navItems = [
    { href: '/legal', label: '홈', icon: Home },
    { href: '/legal/assist/quick', label: '즉시상담', icon: MessageSquare },
    { href: '/legal/contract', label: '계약서 분석', icon: FileText },
    { href: '/legal/situation', label: '상황 분석', icon: MessageSquare },
    { href: '/legal/cases', label: '유사 케이스', icon: BookOpen },
  ]

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-xl border-b border-slate-200/80 shadow-sm">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* 로고 */}
            <Link 
              href="/legal" 
              className="flex items-center gap-2.5 group hover:opacity-90 transition-opacity flex-shrink-0"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg blur-sm opacity-50 group-hover:opacity-75 transition-opacity"></div>
                <div className="relative p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg shadow-sm">
                  <Scale className="w-5 h-5 text-white" />
                </div>
              </div>
              <div className="flex flex-col">
                <span className="text-lg sm:text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent leading-tight">
                  Linkus Legal
                </span>
                <span className="text-[10px] sm:text-xs text-slate-500 font-medium leading-tight hidden sm:block">
                  청년 법률 리스크 탐지
                </span>
              </div>
            </Link>

            {/* 데스크톱 네비게이션 */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href || (item.href !== '/legal' && pathname?.startsWith(item.href))
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm",
                      "transition-all duration-200",
                      isActive
                        ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm"
                        : "text-slate-700 hover:bg-slate-100 hover:text-blue-600"
                    )}
                  >
                    <Icon className={cn(
                      "w-4 h-4 flex-shrink-0",
                      isActive ? "text-white" : "text-slate-500"
                    )} />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </nav>

            {/* 오른쪽 메뉴 */}
            <div className="flex items-center gap-3">
              {/* 사용자 메뉴 */}
              {user ? (
                <div className="relative" ref={userMenuRef}>
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                      <UserCircle className="w-5 h-5 text-white" />
                    </div>
                    <ChevronDown className={cn(
                      "w-4 h-4 text-slate-500 transition-transform",
                      userMenuOpen && "rotate-180"
                    )} />
                  </button>

                  {/* 드롭다운 메뉴 */}
                  {userMenuOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-50">
                      <button
                        onClick={() => {
                          router.push('/my/profile')
                          setUserMenuOpen(false)
                        }}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 transition-colors"
                      >
                        <UserCircle className="w-4 h-4" />
                        <span>마이페이지</span>
                      </button>
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>로그아웃</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <Button
                  onClick={() => router.push('/auth')}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-sm"
                  size="sm"
                >
                  <UserCircle className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">로그인</span>
                  <span className="sm:hidden">로그인</span>
                </Button>
              )}

              {/* 모바일 메뉴 버튼 */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded-lg hover:bg-slate-100 transition-colors"
                aria-label="메뉴"
              >
                {mobileMenuOpen ? (
                  <X className="w-5 h-5 text-slate-700" />
                ) : (
                  <Menu className="w-5 h-5 text-slate-700" />
                )}
              </button>
            </div>
          </div>

          {/* 모바일 네비게이션 메뉴 */}
          {mobileMenuOpen && (
            <div className="md:hidden border-t border-slate-200 py-2">
              <nav className="flex flex-col gap-1">
                {navItems.map((item) => {
                  const Icon = item.icon
                  const isActive = pathname === item.href || (item.href !== '/legal' && pathname?.startsWith(item.href))
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-sm",
                        "transition-all duration-200",
                        isActive
                          ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white"
                          : "text-slate-700 hover:bg-slate-100"
                      )}
                    >
                      <Icon className={cn(
                        "w-5 h-5 flex-shrink-0",
                        isActive ? "text-white" : "text-slate-500"
                      )} />
                      <span>{item.label}</span>
                    </Link>
                  )
                })}
              </nav>
            </div>
          )}
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  )
}
