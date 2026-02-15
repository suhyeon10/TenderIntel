'use client'

import React, { useMemo, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useProfileStore } from '@/stores/useProfileStore'
import Link from 'next/link'

const SideNavigator = () => {
  const pathname = usePathname()
  const account = useProfileStore((state) => state.profile)
  const { fetchMyProfileData } = useProfileStore()
  const [isLoading, setIsLoading] = useState(true)

  // 레이아웃 레벨에서 프로필 미리 로드
  useEffect(() => {
    const loadProfile = async () => {
      try {
        // 프로필이 없거나 초기 상태인 경우에만 로드
        if (!account || !account.role) {
          await fetchMyProfileData()
        }
      } catch (error) {
        console.error('프로필 로드 실패:', error)
      } finally {
        setIsLoading(false)
      }
    }
    loadProfile()
    
    // 프로필 전환 이벤트 리스너
    const handleProfileSwitch = async () => {
      try {
        await fetchMyProfileData()
      } catch (error) {
        console.error('프로필 새로고침 실패:', error)
      }
    }
    window.addEventListener('profileSwitched', handleProfileSwitch)
    
    return () => {
      window.removeEventListener('profileSwitched', handleProfileSwitch)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const routes = useMemo(() => {
    // 프로필이 로드되지 않았거나 없는 경우
    if (!account || !account.role) {
      return []
    }

    // 프로필 타입에 따라 분기
    const isFreelancer = account?.profile_type === 'FREELANCER'
    const isCompany = account?.profile_type === 'COMPANY'

    // 기업 프로필인 경우
    if (isCompany) {
      const companyAccountRoutes = [
        {
          icon: '',
          label: '내 정보 / 회사 정보 수정',
          type: 'company_account',
          isActive: pathname === '/my/company/info',
          href: '/my/company/info',
        },
        {
          icon: '',
          label: '팀 멤버 관리',
          type: 'company_account',
          isActive: pathname === '/my/company/team-members',
          href: '/my/company/team-members',
        },
      ]

      const subscriptionRoutes = [
        {
          icon: '',
          label: '구독 관리',
          type: 'subscription',
          isActive: pathname === '/my/subscription',
          href: '/my/subscription',
        },
        {
          icon: '',
          label: '결제 내역',
          type: 'subscription',
          isActive: pathname === '/my/payments',
          href: '/my/payments',
        },
        {
          icon: '',
          label: '견적서 열람 기록',
          type: 'subscription',
          isActive: pathname === '/my/estimate-view-history',
          href: '/my/estimate-view-history',
        },
      ]

      const projectRoutes = [
        {
          icon: '',
          label: '내 프로젝트',
          type: 'project',
          isActive: pathname === '/my/company/projects',
          href: '/my/company/projects',
        },
        {
          icon: '',
          label: '받은 견적서',
          type: 'project',
          isActive: pathname === '/my/company/estimates',
          href: '/my/company/estimates',
        },
      ]

      const projectHistoryRoutes = [
        {
          icon: '',
          label: '진행 이력',
          type: 'project_history',
          isActive: pathname === '/my/project-history',
          href: '/my/project-history',
        },
        {
          icon: '',
          label: '완료 프로젝트 저장함',
          type: 'project_history',
          isActive: pathname === '/my/completed-projects',
          href: '/my/completed-projects',
        },
      ]

      const settingsRoutes = [
        {
          icon: '',
          label: '알림 설정',
          type: 'settings',
          isActive: pathname === '/my/account/notifications',
          href: '/my/account/notifications',
        },
        {
          icon: '',
          label: '계정 보안',
          type: 'settings',
          isActive: pathname === '/my/account/security',
          href: '/my/account/security',
        },
        {
          icon: '',
          label: '회원 탈퇴',
          type: 'settings',
          isActive: pathname === '/my/account/delete',
          href: '/my/account/delete',
        },
      ]

      return [
        ...companyAccountRoutes,
        ...projectRoutes,
        ...subscriptionRoutes,
        ...projectHistoryRoutes,
        ...settingsRoutes,
      ]
    }

    // 프리랜서 프로필인 경우
    if (isFreelancer) {
      const profileRoutes = [
        {
          icon: '',
          label: '프로필 보기/수정',
          type: 'profile',
          isActive: pathname === '/my/profile' || pathname === '/my/update',
          href: '/my/profile',
        },
      ]

      // 프리랜서 프로필인 경우 팀 관련 메뉴를 내 프로필 그룹에 추가
      profileRoutes.push(
        {
          icon: '',
          label: '팀 프로필 조회',
          type: 'profile',
          isActive: pathname === '/my/team-profile',
          href: '/my/team-profile',
        },
        {
          icon: '',
          label: '팀 프로젝트 확인',
          type: 'profile',
          isActive: pathname === '/my/team-projects',
          href: '/my/team-projects',
        }
      )

      // const proposalRoutes = [
      //   {
      //     icon: '',
      //     label: '받은 프로젝트 제안',
      //     type: 'proposal',
      //     isActive: pathname === '/my/project-proposals',
      //     href: '/my/project-proposals',
      //   },
      //   {
      //     icon: '',
      //     label: '보낸 견적서 (매니저)',
      //     type: 'proposal',
      //     isActive: pathname === '/my/estimates-dashboard',
      //     href: '/my/estimates-dashboard',
      //   },
      // ]

      const interestRoutes = [
        {
          icon: '',
          label: '관심 프로젝트',
          type: 'interest',
          isActive: pathname === '/my/bookmarked-projects',
          href: '/my/bookmarked-projects',
        },
        {
          icon: '',
          label: '관심 메이커',
          type: 'interest',
          isActive: pathname === '/my/bookmarked-makers',
          href: '/my/bookmarked-makers',
        },
      ]

      const accountRoutes = [
        {
          icon: '',
          label: '로그인/보안',
          type: 'account',
          isActive: pathname === '/my/account/security',
          href: '/my/account/security',
        },
        {
          icon: '',
          label: '알림 설정',
          type: 'account',
          isActive: pathname === '/my/account/notifications',
          href: '/my/account/notifications',
        },
      ]

      const historyRoutes = [
        {
          icon: '',
          label: '받은 제안 목록',
          type: 'history',
          isActive: pathname === '/my/received-proposals',
          href: '/my/received-proposals',
        },
        {
          icon: '',
          label: '보낸 요청 목록',
          type: 'history',
          isActive: pathname === '/my/sent-requests',
          href: '/my/sent-requests',
        },
      ]

      return [
        ...profileRoutes,
        // ...proposalRoutes,
        ...interestRoutes,
        ...historyRoutes,
        ...accountRoutes,
      ]
    }

    // 기본 메뉴 (프로필 타입이 없는 경우)
    return []
  }, [pathname, account?.role, account?.profile_type])

  // 로딩 중이거나 라우트가 없어도 최소한 기본 메뉴는 표시
  const profileRoutes = routes.filter((route) => route.type === 'profile')
  // const proposalRoutes = routes.filter((route) => route.type === 'proposal')
  const interestRoutes = routes.filter((route) => route.type === 'interest')
  const historyRoutes = routes.filter((route) => route.type === 'history')
  const accountRoutes = routes.filter((route) => route.type === 'account')
  const myRoutes = routes.filter((route) => route.type === 'my') // 기업용 (레거시)
  const companyAccountRoutes = routes.filter((route) => route.type === 'company_account')
  const projectRoutes = routes.filter((route) => route.type === 'project')
  const subscriptionRoutes = routes.filter((route) => route.type === 'subscription')
  const projectHistoryRoutes = routes.filter((route) => route.type === 'project_history')
  const settingsRoutes = routes.filter((route) => route.type === 'settings')

  const renderRouteGroup = (groupRoutes, groupTitle) => {
    if (groupRoutes.length === 0) return null
    return (
      <div className="flex flex-col gap-4 mt-4">
        <span className="text-p1 text-black80">{groupTitle}</span>
        <div className="flex flex-col gap-4">
          {groupRoutes.map((route, index) => (
            <div
              key={index}
              className={`px-2 py-1 rounded-[14px] text-subtitle2 ${
                route.isActive
                  ? 'text-palette-coolNeutral-10'
                  : 'text-palette-coolNeutral-80'
              }`}
            >
              <Link
                href={route.href}
                className="w-full h-full px-2"
              >
                {route.label}
              </Link>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <>
      {profileRoutes.length > 0 && renderRouteGroup(profileRoutes, '내 프로필')}
      {/* {proposalRoutes.length > 0 && renderRouteGroup(proposalRoutes, '제안 & 메시지')} */}
      {interestRoutes.length > 0 && renderRouteGroup(interestRoutes, '관심항목')}
      {historyRoutes.length > 0 && renderRouteGroup(historyRoutes, '내 히스토리')}
      {accountRoutes.length > 0 && renderRouteGroup(accountRoutes, '계정관리')}
      {companyAccountRoutes.length > 0 && renderRouteGroup(companyAccountRoutes, '회사 계정')}
      {projectRoutes.length > 0 && renderRouteGroup(projectRoutes, '프로젝트')}
      {subscriptionRoutes.length > 0 && renderRouteGroup(subscriptionRoutes, '결제 / 구독')}
      {projectHistoryRoutes.length > 0 && renderRouteGroup(projectHistoryRoutes, '프로젝트 기록')}
      {settingsRoutes.length > 0 && renderRouteGroup(settingsRoutes, '설정')}
      {myRoutes.length > 0 && renderRouteGroup(myRoutes, '마이')}
    </>
  )
}

export default SideNavigator

