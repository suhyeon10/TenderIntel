'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { UserCircleIcon, Bell, LogOut, User, Settings, Menu, X, Users, UserPlus, MessageSquare, CheckCircle, XCircle, Clock, Mail, Handshake, ArrowRight, Inbox } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { acceptTeamProposal, declineTeamProposal } from '@/apis/proposal.service'
import { Button } from '@/components/ui/button'
import { createSupabaseBrowserClient } from '@/supabase/supabase-client'
import { User as SupabaseUser } from '@supabase/supabase-js'
import Navigator from '@/components/Navigator'
import Logo from '@/components/common/Logo'
import ProfileSwitchButton from '@/components/ProfileSwitchButton'
import { getUserProfiles } from '@/apis/profile-refactor.service'
import { Database } from '@/types/supabase'
import Link from 'next/link'
import { useProfileStore } from '@/stores/useProfileStore'

type ProfileType = Database['public']['Enums']['profile_type']

const Header = () => {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [showNotificationMenu, setShowNotificationMenu] = useState(false)
  const [isNotificationMenuPinned, setIsNotificationMenuPinned] = useState(false) // 클릭으로 고정된 상태
  const [activeProfileType, setActiveProfileType] = useState<ProfileType | null>(null)
  const [activeRole, setActiveRole] = useState<'MAKER' | 'MANAGER' | 'NONE' | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [recentMessages, setRecentMessages] = useState<Array<{
    id: string | number
    type: string
    title: string
    content: string
    created_at: string
    status?: string | null
    team_id?: number
    team_member_id?: number
    proposal_id?: number
    canAccept?: boolean
    canDecline?: boolean
  }>>([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const mobileMenuRef = useRef<HTMLDivElement>(null)
  const notificationMenuRef = useRef<HTMLDivElement>(null)
  const supabase = createSupabaseBrowserClient()
  const account = useProfileStore((state) => state.profile)
  const { fetchMyProfileData } = useProfileStore()
  
  // 현재 경로가 auth 페이지인지 확인
  const isAuthPage = pathname?.startsWith('/auth')
  
  // 마이페이지 경로인지 확인
  const isMyPage = pathname?.startsWith('/my')

  const loadActiveProfile = async () => {
    try {
      const profiles = await getUserProfiles()
      const validProfiles = (profiles as any[]).filter((p: any) => p.profile_type !== null)
      const active = validProfiles.find((p: any) => p.is_active)
      if (active) {
        setActiveProfileType(active.profile_type)
        setActiveRole(active.role || null)
      } else {
        setActiveProfileType(null)
        setActiveRole(null)
      }
    } catch (error) {
      console.error('프로필 로드 실패:', error)
    }
  }

  const loadNotifications = async () => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      
      // 인증 오류 발생 시 (403 등) 알림 로드 중단
      if (authError || !user) {
        if (authError?.status === 403 || authError?.message?.includes('403')) {
          console.warn('인증 오류로 인해 알림을 불러올 수 없습니다:', authError.message)
        }
        setUnreadCount(0)
        setRecentMessages([])
        return
      }

      let count = 0
      const messages: Array<{
        id: string | number
        type: string
        title: string
        content: string
        created_at: string
        status?: string | null
        team_id?: number
        team_member_id?: number
        proposal_id?: number
        canAccept?: boolean
        canDecline?: boolean
      }> = []

      // 현재 프로필 확인
      const { data: profile, error: profileError } = await supabase
        .from('accounts')
        .select('profile_id, profile_type, role')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .is('deleted_at', null)
        .maybeSingle()

      if (!profile || profile.profile_type !== 'FREELANCER') {
        setUnreadCount(0)
        setRecentMessages([])
        return
      }

      // 1. 팀 초대 조회 (받은 초대)
      const { data: invites, error: invitesError } = await supabase
        .from('team_members')
        .select(`
          id,
          team_id,
          status,
          request_type,
          created_at,
          teams:team_id (
            name,
            manager_profile_id
          )
        `)
          .eq('profile_id', profile.profile_id)
        .eq('request_type', 'invite')
        .order('created_at', { ascending: false })
        .limit(5)

      if (!invitesError && invites) {
        const unreadInvites = invites.filter((inv: any) => !inv.status)
        count += unreadInvites.length

        // 매니저 정보 조회
        const managerProfileIds = invites
          .map((inv: any) => inv.teams?.manager_profile_id)
          .filter(Boolean) || []
        
        const managerInfo: Record<string, any> = {}
        if (managerProfileIds.length > 0) {
          const { data: managers } = await supabase
            .from('accounts')
            .select('profile_id, username')
            .in('profile_id', managerProfileIds)

          if (managers) {
            managers.forEach((m: any) => {
              managerInfo[m.profile_id] = m
            })
          }
        }

        invites.forEach((invite: any) => {
          const manager = invite.teams?.manager_profile_id 
            ? managerInfo[invite.teams.manager_profile_id]
            : null
          
          messages.push({
            id: `invite-${invite.id}`,
            type: 'team_invite',
            title: '팀 초대',
            content: `${manager?.username || '매니저'}님이 ${invite.teams?.name || '팀'}에 초대했습니다.`,
            created_at: invite.created_at,
            status: invite.status,
            team_id: invite.team_id,
            team_member_id: invite.id,
            canAccept: !invite.status, // status가 null이면 수락 가능
            canDecline: !invite.status, // status가 null이면 거절 가능
          })
        })
      }

      // 2. 팀 제안 조회 (받은 제안)
      const { data: proposals, error: teamProposalsError } = await supabase
        .from('team_proposals')
        .select('id, team_id, manager_id, message, created_at')
        .eq('maker_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5)

      if (!teamProposalsError && proposals) {
        const teamIds = proposals.map((p: any) => p.team_id).filter((id: any) => id !== null) as number[]
        const managerIds = proposals.map((p: any) => p.manager_id).filter(Boolean) || []

        const teamInfo: Record<number, any> = {}
        if (teamIds.length > 0) {
          const { data: teams } = await supabase
            .from('teams')
            .select('id, name')
            .in('id', teamIds)

          if (teams) {
            teams.forEach((team: any) => {
              teamInfo[team.id] = team
            })
          }
        }

        const managerInfo: Record<string, any> = {}
        if (managerIds.length > 0) {
          const { data: managers } = await supabase
            .from('accounts')
            .select('user_id, username')
            .in('user_id', managerIds)

          if (managers) {
            managers.forEach((m: any) => {
              managerInfo[m.user_id] = m
            })
          }
        }

        proposals.forEach((proposal: any) => {
          const team = proposal.team_id ? teamInfo[proposal.team_id] : null
          const manager = managerInfo[proposal.manager_id]
          
          messages.push({
            id: `proposal-${proposal.id}`,
            type: 'team_proposal',
            title: '팀 제안',
            content: `${manager?.username || '매니저'}님이 ${team?.name || '팀'}에 합류를 제안했습니다.`,
            created_at: proposal.created_at,
            proposal_id: proposal.id,
            canAccept: true, // 팀 제안은 항상 수락/거절 가능
            canDecline: true,
          })
        })
      }

      // 3. 받은 합류 요청 조회 (매니저인 경우)
      // manager_profile_id로 팀을 찾아서, 해당 팀에 대한 합류 요청 조회
      // role 조건 없이 manager_profile_id로만 조회 (프로젝트마다 역할이 다를 수 있음)
      const { data: managedTeams } = await supabase
        .from('teams')
        .select('id, name')
        .eq('manager_profile_id', profile.profile_id)

      if (managedTeams && managedTeams.length > 0) {
        const teamIds = managedTeams.map((t: any) => t.id)
        
        const { data: joinRequests, error: joinRequestsError } = await supabase
          .from('team_members')
          .select(`
            id,
            team_id,
            profile_id,
            maker_id,
            status,
            created_at
          `)
          .in('team_id', teamIds)
          .eq('status', 'pending')
          .eq('request_type', 'request')
          .order('created_at', { ascending: false })
          .limit(5)

        if (!joinRequestsError && joinRequests) {
          count += joinRequests.length

          const makerIds = joinRequests.map((r: any) => r.maker_id).filter(Boolean) || []
          const makerInfo: Record<string, any> = {}

          if (makerIds.length > 0) {
            const { data: makers } = await supabase
              .from('accounts')
              .select('user_id, username')
              .in('user_id', makerIds)

            if (makers) {
              makers.forEach((m: any) => {
                makerInfo[m.user_id] = m
              })
            }
          }

          joinRequests.forEach((request: any) => {
            const team = managedTeams.find((t: any) => t.id === request.team_id)
            const maker = makerInfo[request.maker_id]
            
            messages.push({
              id: `join-${request.id}`,
              type: 'join_request',
              title: '합류 요청',
              content: `${maker?.username || '메이커'}님이 ${team?.name || '팀'}에 합류를 요청했습니다.`,
              created_at: request.created_at,
              status: request.status,
              team_id: request.team_id,
              team_member_id: request.id,
              canAccept: request.status === 'pending', // pending 상태면 수락 가능
              canDecline: request.status === 'pending', // pending 상태면 거절 가능
            })
          })
        }
      }

      // 4. 보낸 합류 신청 조회 (메이커가 보낸 합류 신청)
      const { data: sentJoinRequests, error: sentJoinRequestsError } = await supabase
        .from('team_members')
        .select(`
          id,
          team_id,
          status,
          created_at,
          teams:team_id (
            name,
            manager_profile_id
          )
        `)
        .eq('profile_id', profile.profile_id)
        .eq('status', 'pending')
        .eq('request_type', 'request')
        .order('created_at', { ascending: false })
        .limit(5)

      if (!sentJoinRequestsError && sentJoinRequests) {
        sentJoinRequests.forEach((request: any) => {
          messages.push({
            id: `sent-join-${request.id}`,
            type: 'sent_join_request',
            title: '보낸 합류 신청',
            content: `${request.teams?.name || '팀'}에 합류를 신청했습니다.`,
            created_at: request.created_at,
            status: request.status,
            team_id: request.team_id,
            team_member_id: request.id,
            canAccept: false, // 보낸 신청은 수락/거절 불가 (매니저가 처리)
            canDecline: false,
          })
        })
      }

      // 최신순으로 정렬하고 최대 5개만 표시
      messages.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      setRecentMessages(messages.slice(0, 5))
      setUnreadCount(count)
    } catch (error) {
      console.error('알람 로드 실패:', error)
      setUnreadCount(0)
      setRecentMessages([])
    }
  }

  useEffect(() => {
    const getUserInfo = async () => {
      try {
        // 사용자 정보 조회
        const result = await supabase.auth.getUser()
        
        if (result?.data?.user) {
          setUser(result?.data?.user)
          await loadActiveProfile()
          await loadNotifications()
          // 마이페이지인 경우 프로필 데이터 로드
          if (isMyPage && (!account || !account.role)) {
            await fetchMyProfileData()
          }
        } else if (result?.error) {
          // 토큰 손상 오류 (missing sub claim 등) 발생 시 세션 정리
          const isTokenCorrupted = result.error.message?.includes('missing sub claim') || 
                                   result.error.message?.includes('invalid claim') ||
                                   result.error.message?.includes('JWT') ||
                                   result.error.status === 403
          
          if (isTokenCorrupted) {
            console.warn('토큰 손상 감지, 세션 정리 중:', result.error.message)
            try {
              // 손상된 세션 정리
              await supabase.auth.signOut({ scope: 'local' })
              // 로컬 스토리지의 세션 정보도 정리
              if (typeof window !== 'undefined') {
                const keys = Object.keys(localStorage)
                keys.forEach(key => {
                  if (key.includes('supabase') || key.includes('auth')) {
                    localStorage.removeItem(key)
                  }
                })
              }
            } catch (signOutError) {
              console.error('로그아웃 처리 실패:', signOutError)
            }
          } else {
            console.warn('인증 오류:', result.error.message)
          }
          setUser(null)
        }
      } catch (error) {
        console.error('사용자 정보 조회 실패:', error)
        setUser(null)
      }
    }

    getUserInfo()

    // 프로필 전환 이벤트 리스너
    const handleProfileSwitch = () => {
      loadActiveProfile()
      loadNotifications()
      if (isMyPage) {
        fetchMyProfileData()
      }
    }
    window.addEventListener('profileSwitched', handleProfileSwitch)

    // 주기적으로 알람 확인 (30초마다)
    const interval = setInterval(() => {
      loadNotifications()
    }, 30000)

    return () => {
      window.removeEventListener('profileSwitched', handleProfileSwitch)
      clearInterval(interval)
    }
  }, [supabase, pathname, isMyPage]) // pathname도 의존성에 추가하여 프로필 전환 시 업데이트

  // 외부 클릭 시 메뉴 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false)
      }
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target as Node)) {
        setShowMobileMenu(false)
      }
      if (notificationMenuRef.current && !notificationMenuRef.current.contains(event.target as Node)) {
        setShowNotificationMenu(false)
        setIsNotificationMenuPinned(false) // 외부 클릭 시 고정 해제
      }
    }

    if (showUserMenu || showMobileMenu || showNotificationMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showUserMenu, showMobileMenu, showNotificationMenu])

  // 모바일 메뉴 닫기 (경로 변경 시)
  useEffect(() => {
    setShowMobileMenu(false)
  }, [pathname])

  const handleLogout = async () => {
    // 완전한 로그아웃: 모든 스토리지 정리
    await supabase.auth.signOut({ scope: 'global' })
    
    // localStorage와 sessionStorage 정리
    if (typeof window !== 'undefined') {
      // Supabase 관련 키 정리
      const keys = Object.keys(localStorage)
      keys.forEach(key => {
        if (key.includes('supabase') || key.includes('auth')) {
          localStorage.removeItem(key)
        }
      })
      
      // sessionStorage도 정리
      const sessionKeys = Object.keys(sessionStorage)
      sessionKeys.forEach(key => {
        if (key.includes('supabase') || key.includes('auth') || key === 'profileType') {
          sessionStorage.removeItem(key)
        }
      })
    }
    
    setShowUserMenu(false)
    router.push('/')
    window.location.reload()
  }

  // 모바일 메뉴 라우트 생성
  const getMobileRoutes = useMemo(() => {
    // 마이페이지인 경우 SideNavigator의 메뉴 구조 사용
    if (isMyPage && account && account.role) {
      const isFreelancer = account?.profile_type === 'FREELANCER'
      const isCompany = account?.profile_type === 'COMPANY'
      
      if (isCompany) {
        const companyAccountRoutes = [
          { label: '내 정보 / 회사 정보 수정', href: '/my/company/info', group: '회사 계정' },
          { label: '팀 멤버 관리', href: '/my/company/team-members', group: '회사 계정' },
        ]
        const subscriptionRoutes = [
          { label: '구독 관리', href: '/my/subscription', group: '결제 / 구독' },
          { label: '결제 내역', href: '/my/payments', group: '결제 / 구독' },
        ]
        const projectHistoryRoutes = [
          { label: '진행 이력', href: '/my/project-history', group: '프로젝트 기록' },
          { label: '완료 프로젝트 저장함', href: '/my/completed-projects', group: '프로젝트 기록' },
        ]
        const settingsRoutes = [
          { label: '알림 설정', href: '/my/account/notifications', group: '설정' },
          { label: '계정 보안', href: '/my/account/security', group: '설정' },
          { label: '회원 탈퇴', href: '/my/account/delete', group: '설정' },
        ]
        return [
          ...companyAccountRoutes,
          ...subscriptionRoutes,
          ...projectHistoryRoutes,
          ...settingsRoutes,
        ]
      }
      
      if (isFreelancer) {
        const profileRoutes = [
          { label: '프로필 보기/수정', href: '/my/profile', group: '내 프로필' },
        ]
        // const proposalRoutes = [
        //   { label: '받은 프로젝트 제안', href: '/my/project-proposals', group: '제안 & 메시지' },
        //   { label: '보낸 견적서 (매니저)', href: '/my/estimates-dashboard', group: '제안 & 메시지' },
        // ]
        const interestRoutes = [
          { label: '관심 프로젝트', href: '/my/bookmarked-projects', group: '관심항목' },
          { label: '관심 기업', href: '/my/bookmarked-companies', group: '관심항목' },
        ]
        const accountRoutes = [
          { label: '로그인/보안', href: '/my/account/security', group: '계정관리' },
          { label: '알림 설정', href: '/my/account/notifications', group: '계정관리' },
        ]
        const teamRoutes = []
        if (account?.role === 'MANAGER') {
          teamRoutes.push(
            { label: '팀 프로필 조회', href: '/my/team-profile', group: '팀' },
            { label: '팀 프로젝트 확인', href: '/my/team-projects', group: '팀' }
          )
        }
        return [
          ...profileRoutes,
          // ...proposalRoutes,
          ...interestRoutes,
          ...accountRoutes,
          ...teamRoutes,
        ]
      }
    }
    
    // 마이페이지가 아닌 경우 기본 네비게이션 메뉴
    if (activeProfileType === 'COMPANY') {
      return [
        { label: '상담 신청', href: '/enterprise/counsel-form', group: '프로젝트' },
        { label: '전체 프로젝트', href: '/enterprise/my-counsel', group: '프로젝트' },
        { label: '팀 검색', href: '/c/teams' },
      ]
    }
    
    // 프리랜서 프로필인 경우 팀 메뉴 추가
    const freelancerRoutes = [
      { label: '프로젝트 찾기', href: '/search-projects' },
      { label: '메이커 검색', href: '/search-makers' },
    ]
    
    if (activeProfileType === 'FREELANCER') {
      freelancerRoutes.push(
        { label: '팀 검색', href: '/search-teams' }
      )
      if (activeRole === 'MANAGER') {
        freelancerRoutes.push(
          { label: '팀 프로필 조회', href: '/my/team-profile' },
          { label: '팀 프로젝트 확인', href: '/my/team-projects' }
        )
      }
    }
    
    return freelancerRoutes
  }, [isMyPage, account, activeProfileType, activeRole])

  return (
    <>
      <div className="fixed top-0 left-0 right-0 z-[800] w-full h-[64px] flex items-center border-b-[1px] border-solid border-[rgba(0,0,0,0.08)] bg-white/88 backdrop-saturate-[1.5] backdrop-blur-[32px]">
        <div className="absolute inset-0 z-[-1] bg-white/88 backdrop-saturate-[1.5] backdrop-blur-[32px]"></div>
        <header className="flex h-full items-center px-0 md:px-6 w-full md:max-w-[90%] md:mx-auto">
          <div className="flex items-center h-full gap-8 flex-1">
            <Logo />
            {/* 데스크톱 네비게이터 - 모바일에서 숨김 */}
            <div className="hidden md:block">
              <Navigator 
                profileType={activeProfileType || undefined} 
                role={activeRole || undefined}
              />
            </div>
          </div>
          <div className="ml-auto flex items-center gap-4">
            {user ? (
              <>
                {/* 데스크톱 프로필 전환 버튼 - 모바일에서 숨김 */}
                <div className="hidden md:block">
                  <ProfileSwitchButton />
                </div>
                {/* 알림 아이콘 - 모바일에서 숨김 */}
                <div
                  className="hidden md:block relative"
                  ref={notificationMenuRef}
                  onMouseEnter={() => {
                    setShowNotificationMenu(true)
                    setShowUserMenu(false)
                    // 메시지 로드 (호버 시에만)
                    if (recentMessages.length === 0 && !loadingMessages) {
                      loadNotifications()
                    }
                  }}
                  onMouseLeave={() => {
                    // 클릭으로 고정된 경우에만 유지, 그 외에는 닫기
                    if (!isNotificationMenuPinned) {
                      setShowNotificationMenu(false)
                    }
                  }}
                >
                  <Bell
                    size={24}
                    color="#4a4a4a"
                    strokeWidth={1.5}
                    className="cursor-pointer"
                    onClick={() => {
                      const newState = !showNotificationMenu
                      setShowNotificationMenu(newState)
                      setIsNotificationMenuPinned(newState) // 클릭 시 고정 상태 토글
                      setShowUserMenu(false)
                      // 클릭 시 메시지 로드
                      if (newState && recentMessages.length === 0 && !loadingMessages) {
                        loadNotifications()
                      }
                    }}
                  />
                  {unreadCount > 0 && (
                  <div className="absolute top-0 right-0 w-[10px] h-[10px] bg-palette-blue-50 rounded-full border-2 border-white"></div>
                  )}
                  {showNotificationMenu && (
                    <div 
                      className="absolute right-0 top-full mt-1 w-96 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50"
                      onMouseEnter={() => {
                        // 메뉴 영역에 호버하면 계속 유지
                        setShowNotificationMenu(true)
                      }}
                      onMouseLeave={() => {
                        // 메뉴 영역에서 벗어나면 닫기 (단, 클릭으로 고정된 경우는 제외)
                        if (!isNotificationMenuPinned) {
                          setShowNotificationMenu(false)
                        }
                      }}
                    >
                      {/* 헤더 */}
                      <div className="px-5 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-100">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                              <Bell className="w-4 h-4 text-blue-600" />
                            </div>
                            <h3 className="text-sm font-semibold text-gray-900">알림</h3>
                            {unreadCount > 0 && (
                              <span className="px-2 py-0.5 text-xs font-medium bg-blue-600 text-white rounded-full">
                                {unreadCount}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* 최근 메시지 목록 */}
                      {recentMessages.length > 0 ? (
                        <div className="max-h-[400px] overflow-y-auto">
                          {recentMessages.map((message) => {
                            const handleMessageAction = async (action: 'accept' | 'decline') => {
                              try {
                                if (message.type === 'team_invite' && message.team_member_id) {
                                  // 팀 초대 수락/거절
                                  const { error } = await supabase
                                    .from('team_members')
                                    .update({
                                      status: action === 'accept' ? 'active' : 'declined',
                                      updated_at: new Date().toISOString(),
                                    })
                                    .eq('id', message.team_member_id)

                                  if (error) throw error

                                  toast({
                                    title: action === 'accept' ? '팀 초대를 수락했습니다' : '팀 초대를 거절했습니다',
                                  })
                                } else if (message.type === 'team_proposal' && message.proposal_id) {
                                  // 팀 제안 수락/거절
                                  if (action === 'accept') {
                                    await acceptTeamProposal(message.proposal_id)
                                    toast({
                                      title: '팀 제안을 수락했습니다',
                                    })
                                  } else {
                                    await declineTeamProposal(message.proposal_id)
                                    toast({
                                      title: '팀 제안을 거절했습니다',
                                    })
                                  }
                                } else if (message.type === 'join_request' && message.team_member_id) {
                                  // 합류 요청 수락/거절 (매니저)
                                  const { error } = await supabase
                                    .from('team_members')
                                    .update({
                                      status: action === 'accept' ? 'active' : 'declined',
                                      updated_at: new Date().toISOString(),
                                    })
                                    .eq('id', message.team_member_id)

                                  if (error) throw error

                                  toast({
                                    title: action === 'accept' ? '합류 신청을 수락했습니다' : '합류 신청을 거절했습니다',
                                  })
                                }

                                // 메시지 목록 새로고침
                                await loadNotifications()
                              } catch (error: any) {
                                console.error('메시지 처리 실패:', error)
                                toast({
                                  variant: 'destructive',
                                  title: '처리에 실패했습니다',
                                  description: error.message,
                                })
                              }
                            }

                            // 메시지 타입별 아이콘 및 색상
                            const getMessageIcon = () => {
                              switch (message.type) {
                                case 'team_invite':
                                  return <UserPlus className="w-5 h-5 text-blue-500" />
                                case 'team_proposal':
                                  return <Users className="w-5 h-5 text-purple-500" />
                                case 'join_request':
                                  return <Users className="w-5 h-5 text-green-500" />
                                case 'sent_join_request':
                                  return <Clock className="w-5 h-5 text-amber-500" />
                                default:
                                  return <Mail className="w-5 h-5 text-gray-400" />
                              }
                            }

                            const getMessageBgColor = () => {
                              switch (message.type) {
                                case 'team_invite':
                                  return 'bg-blue-50'
                                case 'team_proposal':
                                  return 'bg-purple-50'
                                case 'join_request':
                                  return 'bg-green-50'
                                case 'sent_join_request':
                                  return 'bg-amber-50'
                                default:
                                  return 'bg-gray-50'
                              }
                            }

                            return (
                              <div
                                key={message.id}
                                className="px-5 py-4 border-b border-gray-100 last:border-b-0 hover:bg-gray-50/50 transition-colors"
                              >
                                <div className="flex items-start gap-3">
                                  {/* 아이콘 */}
                                  <div className={`w-10 h-10 ${getMessageBgColor()} rounded-lg flex items-center justify-center flex-shrink-0`}>
                                    {getMessageIcon()}
                                  </div>
                                  
                                  {/* 내용 */}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2 mb-1">
                                      <p className="text-sm font-semibold text-gray-900">{message.title}</p>
                                      <span className="text-[10px] text-gray-400 whitespace-nowrap">
                                        {new Date(message.created_at).toLocaleDateString('ko-KR', {
                                          month: 'short',
                                          day: 'numeric',
                                          hour: '2-digit',
                                          minute: '2-digit',
                                        })}
                                      </span>
                                    </div>
                                    <p className="text-xs text-gray-600 leading-relaxed mb-3 line-clamp-2">
                                      {message.content}
                                    </p>
                                    
                                    {/* 수락/거절 버튼 */}
                                    {(message.canAccept || message.canDecline) && (
                                      <div className="flex gap-2 mb-2">
                                        {message.canAccept && (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              handleMessageAction('accept')
                                            }}
                                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors shadow-sm"
                                          >
                                            <CheckCircle className="w-3.5 h-3.5" />
                                            수락
                                          </button>
                                        )}
                                        {message.canDecline && (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              handleMessageAction('decline')
                                            }}
                                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                                          >
                                            <XCircle className="w-3.5 h-3.5" />
                                            거절
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <div className="px-5 py-12 text-center">
                          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                            <Inbox className="w-8 h-8 text-gray-400" />
                          </div>
                          <p className="text-sm font-medium text-gray-900 mb-1">새로운 알림이 없습니다</p>
                          <p className="text-xs text-gray-500">새로운 메시지가 도착하면 여기에 표시됩니다</p>
                        </div>
                      )}

                      {/* 모든 메시지 보기 버튼 */}
                      <div className="px-5 py-3 bg-gray-50 border-t border-gray-100">
                        <button
                          onClick={() => {
                            router.push('/my/messages')
                            setShowNotificationMenu(false)
                            setIsNotificationMenuPinned(false)
                          }}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 rounded-lg transition-colors border border-gray-200 shadow-sm"
                        >
                          <Inbox className="w-4 h-4" />
                          모든 메시지 보기
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                {/* 사용자 메뉴 */}
                <div className="relative" ref={menuRef}>
                  <UserCircleIcon
                    size={28}
                    color="#4a4a4a"
                    strokeWidth={1.5}
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="cursor-pointer"
                  />
                  {showUserMenu && (
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                      <button
                        onClick={() => {
                          router.push('/my/profile')
                          setShowUserMenu(false)
                        }}
                        className="w-full px-4 py-2 text-left text-xs text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                      >
                        <User className="w-4 h-4" />
                        내 프로필
                      </button>
                      <button
                        onClick={() => {
                          router.push('/my/profile/manage')
                          setShowUserMenu(false)
                        }}
                        className="w-full px-4 py-2 text-left text-xs text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                      >
                        <Settings className="w-4 h-4" />
                        프로필 관리
                      </button>
                      <div className="border-t border-gray-200 my-1"></div>
                      <button
                        onClick={handleLogout}
                        className="w-full px-4 py-2 text-left text-xs text-red-600 hover:bg-red-50 flex items-center gap-2"
                      >
                        <LogOut className="w-4 h-4" />
                        로그아웃
                      </button>
                    </div>
                  )}
                </div>
                {/* 모바일 햄버거 메뉴 버튼 */}
                <button
                  onClick={() => setShowMobileMenu(!showMobileMenu)}
                  className="md:hidden p-2"
                  aria-label="메뉴"
                >
                  {showMobileMenu ? (
                    <X size={24} color="#4a4a4a" strokeWidth={1.5} />
                  ) : (
                    <Menu size={24} color="#4a4a4a" strokeWidth={1.5} />
                  )}
                </button>
              </>
            ) : (
              <div className="flex items-center gap-4">
                {isAuthPage ? (
                  <Button onClick={() => router.push('/auth?role=maker')} className="hidden sm:inline-flex">회원 가입</Button>
                ) : (
                  <Button onClick={() => router.push('/auth?role=maker')} className="hidden sm:inline-flex">로그인</Button>
                )}
                {/* 모바일 로그인 버튼 */}
                <button
                  onClick={() => router.push('/auth?role=maker')}
                  className="sm:hidden p-2"
                  aria-label="로그인"
                >
                  <UserCircleIcon size={24} color="#4a4a4a" strokeWidth={1.5} />
                </button>
              </div>
            )}
          </div>
        </header>
      </div>

      {/* 모바일 사이드 메뉴 */}
      {showMobileMenu && (
        <>
          {/* 오버레이 */}
          <div
            className="fixed inset-0 bg-black/50 z-[900] md:hidden"
            onClick={() => setShowMobileMenu(false)}
          />
          {/* 사이드 메뉴 */}
          <div
            ref={mobileMenuRef}
            className="fixed top-[64px] right-0 h-[calc(100vh-64px)] w-80 bg-white shadow-xl z-[901] md:hidden overflow-y-auto"
          >
            <div className="p-4 space-y-4">
              {/* 프로필 전환 버튼 (로그인한 경우) */}
              {user && (
                <div className="pb-4 border-b border-gray-200">
                  <ProfileSwitchButton />
                </div>
              )}
              
              {/* 알림 메뉴 (모바일에서도 표시) */}
              {user && (
                <div className="pb-4 border-b border-gray-200">
                  <Link
                    href="/my/messages"
                    onClick={() => setShowMobileMenu(false)}
                    className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <Bell className="w-5 h-5" />
                    <span>알림</span>
                    {unreadCount > 0 && (
                      <span className="ml-auto bg-palette-blue-50 text-white text-xs font-semibold px-2 py-1 rounded-full min-w-[20px] text-center">
                        {unreadCount}
                      </span>
                    )}
                  </Link>
                </div>
              )}

              {/* 네비게이션 메뉴 */}
              <nav className="space-y-2">
                {/* 일반 네비게이션 메뉴 (항상 표시) */}
                {(() => {
                  // Navigator 컴포넌트와 동일한 로직으로 일반 네비게이션 메뉴 생성
                  let generalRoutes: Array<{ label: string; href: string; group?: string }> = []
                  
                  if (activeProfileType === 'COMPANY') {
                    generalRoutes = [
                      { label: '상담 신청', href: '/enterprise/counsel-form', group: '프로젝트' },
                      { label: '전체 프로젝트', href: '/enterprise/all-projects', group: '프로젝트' },
                      { label: '내 프로젝트', href: '/enterprise/my-counsel', group: '프로젝트' },
                      { label: '팀 검색', href: '/c/teams' },
                    ]
                  } else {
                    generalRoutes = [
                      { label: '프로젝트 찾기', href: '/search-projects' },
                      { label: '메이커 검색', href: '/search-makers' },
                      { label: '팀 검색', href: '/search-teams' },
                    ]
                  }
                  
                  // 그룹별로 분류
                  const groupedRoutes = generalRoutes.reduce((acc, route) => {
                    const group = route.group || '메뉴'
                    if (!acc[group]) {
                      acc[group] = []
                    }
                    acc[group].push(route)
                    return acc
                  }, {} as Record<string, typeof generalRoutes>)
                  
                  return Object.entries(groupedRoutes).map(([groupName, groupRoutes]) => (
                    <div key={groupName} className="mb-6">
                      <h3 className="text-xs font-semibold text-gray-900 mb-2 px-4">{groupName}</h3>
                      <div className="space-y-1">
                        {groupRoutes.map((route) => (
                          <Link
                            key={route.href}
                            href={route.href}
                            onClick={() => setShowMobileMenu(false)}
                            className={`block px-4 py-2.5 rounded-lg transition-colors ${
                              pathname === route.href
                                ? 'bg-gray-100 text-palette-coolNeutral-20 font-semibold'
                                : 'text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            {route.label}
                          </Link>
                        ))}
                      </div>
                    </div>
                  ))
                })()}

                {/* 마이페이지 세부 메뉴 (마이페이지일 때만 표시) */}
                {isMyPage && account && account.role && (
                  (() => {
                    const routes = getMobileRoutes as Array<{ label: string; href: string; group?: string }>
                    const groupedRoutes = routes.reduce((acc, route) => {
                      const group = route.group || '기타'
                      if (!acc[group]) {
                        acc[group] = []
                      }
                      acc[group].push(route)
                      return acc
                    }, {} as Record<string, typeof routes>)
                    
                    return Object.entries(groupedRoutes).map(([groupName, groupRoutes]) => (
                      <div key={groupName} className="mb-6">
                        <h3 className="text-xs font-semibold text-gray-900 mb-2 px-4">{groupName}</h3>
                        <div className="space-y-1">
                          {groupRoutes.map((route) => (
                            <Link
                              key={route.href}
                              href={route.href}
                              onClick={() => setShowMobileMenu(false)}
                              className={`block px-4 py-2.5 rounded-lg transition-colors ${
                                pathname === route.href
                                  ? 'bg-gray-100 text-palette-coolNeutral-20 font-semibold'
                                  : 'text-gray-700 hover:bg-gray-50'
                              }`}
                            >
                              {route.label}
                            </Link>
                          ))}
                        </div>
                      </div>
                    ))
                  })()
                )}
              </nav>

              {/* 사용자 메뉴 (로그인한 경우, 마이페이지가 아닐 때만 표시) */}
              {user && !isMyPage && (
                <>
                  <div className="pt-4 border-t border-gray-200 space-y-2">
                    <Link
                      href="/my/profile"
                      onClick={() => setShowMobileMenu(false)}
                      className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <User className="w-5 h-5" />
                      <span>내 프로필</span>
                    </Link>
                    <Link
                      href="/my/profile/manage"
                      onClick={() => setShowMobileMenu(false)}
                      className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <Settings className="w-5 h-5" />
                      <span>프로필 관리</span>
                    </Link>
                    <button
                      onClick={() => {
                        handleLogout()
                        setShowMobileMenu(false)
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <LogOut className="w-5 h-5" />
                      <span>로그아웃</span>
                    </button>
                  </div>
                </>
              )}
              
              {/* 로그아웃 버튼 (마이페이지에서만 표시) */}
              {user && isMyPage && (
                <div className="pt-4 border-t border-gray-200">
                  <button
                    onClick={() => {
                      handleLogout()
                      setShowMobileMenu(false)
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut className="w-5 h-5" />
                    <span>로그아웃</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  )
}

export default Header
