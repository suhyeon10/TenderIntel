'use client'

import { useEffect, useState } from 'react'
import { getUserProfiles, createProfile } from '@/apis/profile-refactor.service'
import { Database } from '@/types/supabase'

type ProfileType = Database['public']['Enums']['profile_type']
type Profile = {
  user_id: string
  profile_id: string
  username: string
  profile_type: ProfileType
  bio: string
  main_job: string[] | null
  expertise: string[] | null
  badges: string[] | null
  is_active: boolean | null
}

interface ProfileSelectorProps {
  selectedProfileId: string | null
  onProfileSelect: (profileId: string) => void
  onCreateProfile?: () => void
}

export default function ProfileSelector({
  selectedProfileId,
  onProfileSelect,
  onCreateProfile,
}: ProfileSelectorProps) {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadProfiles()
  }, [])

  const loadProfiles = async () => {
    try {
      setLoading(true)
      const data = await getUserProfiles()
      setProfiles(data as Profile[])
    } catch (err: any) {
      setError(err.message || '프로필을 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="p-4 text-center text-gray-500">
        프로필을 불러오는 중...
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 text-center text-red-500">
        {error}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        프로필 선택
      </label>
      
      {profiles.length === 0 ? (
        <div className="p-4 border-2 border-dashed border-gray-300 rounded-lg text-center">
          <p className="text-gray-500 mb-3">생성된 프로필이 없습니다.</p>
          {onCreateProfile && (
            <button
              onClick={onCreateProfile}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              프로필 생성하기
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {profiles.map((profile) => (
            <button
              key={profile.profile_id}
              onClick={() => onProfileSelect(profile.profile_id)}
              className={`w-full p-4 border-2 rounded-lg text-left transition-all ${
                selectedProfileId === profile.profile_id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-gray-900">
                      {profile.username}
                    </span>
                    <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">
                      {profile.profile_type === 'FREELANCER' ? '프리랜서' : '기업'}
                    </span>
                    {profile.is_active && (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-600">
                        활성
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-1">
                    {profile.bio || '소개가 없습니다.'}
                  </p>
                  {profile.badges && profile.badges.length > 0 && (
                    <div className="flex gap-1 mt-2">
                      {profile.badges.slice(0, 3).map((badge, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 text-xs rounded-full bg-yellow-100 text-yellow-700"
                        >
                          {badge}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {selectedProfileId === profile.profile_id && (
                  <div className="ml-2 text-blue-500">✓</div>
                )}
              </div>
            </button>
          ))}
          
          {onCreateProfile && (
            <button
              onClick={onCreateProfile}
              className="w-full p-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors"
            >
              + 프로필 추가 생성
            </button>
          )}
        </div>
      )}
    </div>
  )
}

