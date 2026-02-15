'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { getUserProfiles, switchActiveProfile } from '@/apis/profile-refactor.service'
import { Database } from '@/types/supabase'
import { Button } from '@/components/ui/button'
import { User, Building2 } from 'lucide-react'

type ProfileType = Database['public']['Enums']['profile_type']
type Profile = {
  user_id: string
  profile_id: string
  username: string
  profile_type: ProfileType
  bio: string
  is_active: boolean | null
}

export default function ProfileSwitchButton() {
  const router = useRouter()
  const pathname = usePathname()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [activeProfile, setActiveProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [switching, setSwitching] = useState(false)

  useEffect(() => {
    loadProfiles()
    
    // 프로필 전환 이벤트 리스너
    const handleProfileSwitch = () => {
      loadProfiles()
    }
    window.addEventListener('profileSwitched', handleProfileSwitch)

    return () => {
      window.removeEventListener('profileSwitched', handleProfileSwitch)
    }
  }, [])

  const loadProfiles = async () => {
    try {
      const data = await getUserProfiles()
      // profile_type이 null이 아닌 프로필만 필터링
      const validProfiles = (data as any[]).filter((p: any) => p.profile_type !== null) as Profile[]
      setProfiles(validProfiles)
      const active = validProfiles.find((p: any) => p.is_active)
      setActiveProfile(active || (validProfiles.length > 0 ? validProfiles[0] : null))
    } catch (error) {
      console.error('프로필 로드 실패:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleToggle = async () => {
    if (profiles.length < 2 || !activeProfile || switching) {
      return
    }

    try {
      setSwitching(true)
      
      // 다른 프로필 찾기
      const otherProfile = profiles.find((p) => p.profile_id !== activeProfile.profile_id)
      if (!otherProfile) {
        return
      }

      // 프로필 타입으로 전환 (FREELANCER 또는 COMPANY)
      await switchActiveProfile(otherProfile.profile_type as string)
      await loadProfiles()
      
      // 프로필 전환 이벤트 발생 (Header에서 수신)
      window.dispatchEvent(new Event('profileSwitched'))
      
      // 프로필 페이지 새로고침
      router.refresh()
    } catch (error: any) {
      console.error('프로필 전환 실패:', error)
      alert(`프로필 전환에 실패했습니다: ${error.message || error}`)
    } finally {
      setSwitching(false)
    }
  }

  const getProfileIcon = (type: ProfileType) => {
    return type === 'FREELANCER' ? <User className="w-4 h-4" /> : <Building2 className="w-4 h-4" />
  }

  const getProfileLabel = (type: ProfileType) => {
    return type === 'FREELANCER' ? '프리랜서' : '기업'
  }

  if (loading || !activeProfile) {
    return null
  }

  // 프로필이 1개만 있으면 프로필 관리로 이동
  if (profiles.length <= 1) {
    return (
      <Button
        variant="outline"
        onClick={() => router.push('/my/profile/manage')}
        className="flex items-center gap-2 text-sm"
      >
        {getProfileIcon(activeProfile.profile_type)}
        <span>{activeProfile.username}</span>
      </Button>
    )
  }

  // 프로필이 2개 이상이면 토글로 전환
  const freelancerProfile = profiles.find((p) => p.profile_type === 'FREELANCER')
  const companyProfile = profiles.find((p) => p.profile_type === 'COMPANY')
  const isFreelancerActive = activeProfile?.profile_type === 'FREELANCER'

  return (
    <div className="flex items-center gap-2">
      <div className="relative inline-flex items-center bg-gray-100 rounded-lg p-1 border border-gray-200">
        <button
          onClick={async () => {
            if (freelancerProfile && !isFreelancerActive && !switching) {
              try {
                setSwitching(true)
                await switchActiveProfile('FREELANCER')
                await loadProfiles()
                window.dispatchEvent(new Event('profileSwitched'))
                
                // my 페이지에 있으면 새로고침
                if (pathname?.startsWith('/my')) {
                  window.location.reload()
                } else {
                  router.refresh()
                }
              } catch (error: any) {
                console.error('프로필 전환 실패:', error)
                alert(`프로필 전환에 실패했습니다: ${error.message || error}`)
              } finally {
                setSwitching(false)
              }
            }
          }}
          disabled={switching || !freelancerProfile}
          className={`
            relative px-4 py-2 rounded-md text-sm font-medium transition-all duration-200
            flex items-center gap-2 min-w-[100px] justify-center
            ${isFreelancerActive
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
            }
            ${switching || !freelancerProfile ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          `}
        >
          <User className="w-4 h-4" />
          <span>프리랜서</span>
        </button>
        <button
          onClick={async () => {
            if (companyProfile && !isFreelancerActive && !switching) {
              // 이미 기업 프로필이 활성화되어 있으면 전환하지 않음
              return
            }
            if (companyProfile && isFreelancerActive && !switching) {
              try {
                setSwitching(true)
                await switchActiveProfile('COMPANY')
                await loadProfiles()
                window.dispatchEvent(new Event('profileSwitched'))
                
                // my 페이지에 있으면 새로고침
                if (pathname?.startsWith('/my')) {
                  window.location.reload()
                } else {
                  router.refresh()
                }
              } catch (error: any) {
                console.error('프로필 전환 실패:', error)
                alert(`프로필 전환에 실패했습니다: ${error.message || error}`)
              } finally {
                setSwitching(false)
              }
            }
          }}
          disabled={switching || !companyProfile}
          className={`
            relative px-4 py-2 rounded-md text-sm font-medium transition-all duration-200
            flex items-center gap-2 min-w-[100px] justify-center
            ${!isFreelancerActive
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
            }
            ${switching || !companyProfile ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          `}
        >
          <Building2 className="w-4 h-4" />
          <span>기업</span>
        </button>
      </div>
      {switching && (
        <span className="text-xs text-gray-500">전환 중...</span>
      )}
    </div>
  )
}

