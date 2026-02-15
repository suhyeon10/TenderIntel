'use client'

import React, { useMemo, useState, useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { ChevronDown } from 'lucide-react'

type ProfileType = 'FREELANCER' | 'COMPANY' | null

interface NavigatorProps {
  profileType?: ProfileType
  role?: 'MAKER' | 'MANAGER' | 'NONE'
}

interface Route {
  icon: string
  label: string
  isActive: boolean
  href: string | null
  isDropdown?: boolean
}

const Navigator = ({ profileType, role }: NavigatorProps) => {
  const pathname = usePathname()
  const [showTeamMenu, setShowTeamMenu] = useState(false)
  const [showProjectMenu, setShowProjectMenu] = useState(false)
  const teamMenuRef = useRef<HTMLDivElement>(null)
  const projectMenuRef = useRef<HTMLDivElement>(null)

  // 외부 클릭 시 메뉴 닫기 (드롭다운 메뉴가 있을 때만)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (teamMenuRef.current && !teamMenuRef.current.contains(event.target as Node)) {
        setShowTeamMenu(false)
      }
      if (projectMenuRef.current && !projectMenuRef.current.contains(event.target as Node)) {
        setShowProjectMenu(false)
      }
    }

    if (showTeamMenu || showProjectMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showTeamMenu, showProjectMenu])

  const routes = useMemo(() => {
    // 기업 프로필일 때
    if (profileType === 'COMPANY') {
      return [
        {
          icon: '',
          label: '프로젝트',
          isActive: pathname === '/enterprise/my-counsel' || pathname === '/enterprise/counsel-form' || pathname === '/enterprise/all-projects',
          href: null,
          isDropdown: true,
        },
        {
          icon: '',
          label: '팀 검색',
          isActive: pathname === '/c/teams',
          href: '/c/teams',
        },
      ]
    }
    
    // 프리랜서 프로필이거나 프로필 타입이 없을 때 (기본값)
    const freelancerRoutes: Route[] = [
      {
        icon: '',
        label: '프로젝트 찾기',
        isActive: pathname === '/search-projects',
        href: '/search-projects',
      },
      {
        icon: '',
        label: '메이커 검색',
        isActive: pathname === '/search-makers',
        href: '/search-makers',
      },
      {
        icon: '',
        label: '팀 검색',
        isActive: pathname === '/search-teams',
        href: '/search-teams',
      },
    ]

    return freelancerRoutes
  }, [pathname, profileType, role])

  return (
    <nav className="flex space-x-10">
      {routes.map((route) => {
        if ('isDropdown' in route && route.isDropdown) {
          // 기업 프로필의 프로젝트 드롭다운
          if (profileType === 'COMPANY' && route.label === '프로젝트') {
            return (
              <div
                key={route.label}
                ref={projectMenuRef}
                className="relative"
              >
                <button
                  onClick={() => setShowProjectMenu(!showProjectMenu)}
                  className={`text-sm font-semibold transition-colors duration-200 flex items-center gap-1 ${
                    route.isActive
                      ? 'text-palette-coolNeutral-20'
                      : 'text-palette-coolNeutral-70 hover:text-palette-coolNeutral-20'
                  }`}
                >
                  {route.label}
                  <ChevronDown className={`w-4 h-4 transition-transform ${showProjectMenu ? 'rotate-180' : ''}`} />
                </button>
                {showProjectMenu && (
                  <div className="absolute left-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                    <Link
                      href="/enterprise/counsel-form"
                      onClick={() => setShowProjectMenu(false)}
                      className={`block px-4 py-2 text-xs transition-colors ${
                        pathname === '/enterprise/counsel-form'
                          ? 'bg-gray-100 text-palette-coolNeutral-20'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      상담 신청
                    </Link>
                    <Link
                      href="/enterprise/all-projects"
                      onClick={() => setShowProjectMenu(false)}
                      className={`block px-4 py-2 text-xs transition-colors ${
                        pathname === '/enterprise/all-projects'
                          ? 'bg-gray-100 text-palette-coolNeutral-20'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      전체 프로젝트
                    </Link>
                    <Link
                      href="/enterprise/my-counsel"
                      onClick={() => setShowProjectMenu(false)}
                      className={`block px-4 py-2 text-xs transition-colors ${
                        pathname === '/enterprise/my-counsel'
                          ? 'bg-gray-100 text-palette-coolNeutral-20'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      내 프로젝트
                    </Link>
                  </div>
                )}
              </div>
            )
          }
          
          // 프리랜서 프로필의 팀 드롭다운
          return (
            <div
              key={route.label}
              ref={teamMenuRef}
              className="relative"
            >
              <button
                onClick={() => setShowTeamMenu(!showTeamMenu)}
                className={`text-sm font-semibold transition-colors duration-200 flex items-center gap-1 ${
                  route.isActive
                    ? 'text-palette-coolNeutral-20'
                    : 'text-palette-coolNeutral-70 hover:text-palette-coolNeutral-20'
                }`}
              >
                {route.label}
                <ChevronDown className={`w-4 h-4 transition-transform ${showTeamMenu ? 'rotate-180' : ''}`} />
              </button>
              {showTeamMenu && (
                <div className="absolute left-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                  <Link
                    href="/my/team-profile"
                    onClick={() => setShowTeamMenu(false)}
                    className={`block px-4 py-2 text-xs transition-colors ${
                      pathname === '/my/team-profile'
                        ? 'bg-gray-100 text-palette-coolNeutral-20'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    팀 프로필 조회
                  </Link>
                  <Link
                    href="/my/team-projects"
                    onClick={() => setShowTeamMenu(false)}
                    className={`block px-4 py-2 text-xs transition-colors ${
                      pathname === '/my/team-projects'
                        ? 'bg-gray-100 text-palette-coolNeutral-20'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    팀 프로젝트 확인
                  </Link>
                </div>
              )}
            </div>
          )
        }

        return (
          <div
            key={route.label}
            className="text-sm font-semibold text-palette-coolNeutral-70 hover:text-palette-coolNeutral-20 transition-colors duration-200"
          >
            <Link href={route.href || '#'}>{route.label}</Link>
          </div>
        )
      })}
    </nav>
  )
}

export default Navigator

