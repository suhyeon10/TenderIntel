'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { UserCircleIcon, Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createSupabaseBrowserClient } from '@/supabase/supabase-client'
import Logo from './common/Logo'

const EnterpriseNavigator: React.FC = () => {
  const router = useRouter()
  const [user, setUser] = useState<any>()
  const supabase = createSupabaseBrowserClient()

  useEffect(() => {
    const getUserInfo = async () => {
      const result = await supabase.auth.getUser()
      if (result?.data?.user) setUser(result?.data?.user)
    }

    getUserInfo()
  }, [supabase])

  return (
    <div className="z-800 w-full h-[64px] items-center border-b-[1px] border-solid border-[rgba(0,0,0,0.08)] px-3">
      <div className="absolute inset-0 z-[-1] bg-white/88 backdrop-saturate-[1.5] backdrop-blur-[32px]"></div>
      
      <header className="flex max-w-[1024px] h-full items-center mx-auto">
        <nav className="flex items-center h-full gap-8">
          <Logo />
          
          {/* 기업 전용 네비게이션 */}
          <div className="flex space-x-8">
            <Link 
              href="/enterprise" 
              className="text-subtitle4 text-palette-coolNeutral-70 hover:text-palette-coolNeutral-20 transition-colors duration-200"
            >
              홈
            </Link>
            <Link 
              href="/enterprise/counsel-form" 
              className="text-subtitle4 text-palette-coolNeutral-70 hover:text-palette-coolNeutral-20 transition-colors duration-200"
            >
              상담 신청
            </Link>
            <Link 
              href="/enterprise/search-makers" 
              className="text-subtitle4 text-palette-coolNeutral-70 hover:text-palette-coolNeutral-20 transition-colors duration-200"
            >
              메이커 검색
            </Link>
            <Link 
              href="/enterprise/my-counsel" 
              className="text-subtitle4 text-palette-coolNeutral-70 hover:text-palette-coolNeutral-20 transition-colors duration-200"
            >
              내 프로젝트
            </Link>
          </div>
        </nav>
        
        <div className="ml-auto">
          {user ? (
            <div className="flex items-center gap-4">
              <div className="relative">
                <Bell
                  size={24}
                  color="#4a4a4a"
                  strokeWidth={1.5}
                />
                <div className="absolute top-0 right-0 w-[10px] h-[10px] bg-palette-blue-50 rounded-full border-2 border-white"></div>
              </div>
              <UserCircleIcon
                size={28}
                color="#4a4a4a"
                strokeWidth={1.5}
                onClick={() => router.push('/enterprise/my-counsel')}
                className="cursor-pointer"
              />
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <Button onClick={() => router.push('/auth?role=client')}>회원 가입</Button>
              <Button onClick={() => router.push('/auth?role=client')}>로그인</Button>
            </div>
          )}
        </div>
      </header>
    </div>
  )
}

export default EnterpriseNavigator;
