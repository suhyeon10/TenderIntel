import React from 'react'
import { calculateTotalExperience } from '@/lib/transformExperienceDate'

//TODO - ZOD 반영
interface Maker {
  username: string
  main_job: string[] | null
  expertise: string[] | null
  bio: string
  user_id: string
  profile_id?: string // 새로운 프로필 시스템
  profile_type?: 'FREELANCER' | 'COMPANY' | null
  is_active?: boolean | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  role: 'MAKER' | 'MANAGER' | 'NONE'
  account_work_experiences: any[]
}

interface SearchMakerCardProps {
  maker: Maker
}

export const SearchMakerCard = ({ maker }: SearchMakerCardProps) => {
  const totalExp = maker.account_work_experiences.length > 0
    ? calculateTotalExperience(maker.account_work_experiences)
    : null

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-lg hover:border-blue-300 transition-all duration-300 p-6 cursor-pointer">
      <div className="flex gap-5 items-start w-full">
        {/* 프로필 이미지 */}
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
          {maker.username?.[0]?.toUpperCase() || '?'}
        </div>
        
        {/* 메이커 정보 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between mb-3">
            <h3 className="text-xl font-bold text-gray-900">{maker.username}</h3>
            {totalExp && (
              <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-lg text-sm font-semibold whitespace-nowrap">
                경력 {totalExp.years}년 {totalExp.months}개월
              </span>
            )}
            {!totalExp && (
              <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-lg text-sm font-semibold whitespace-nowrap">
                신입
              </span>
            )}
          </div>

          {/* 소개 */}
          {maker.bio && (
            <p className="text-gray-600 text-base mb-4 line-clamp-2 leading-relaxed">
              {maker.bio}
            </p>
          )}

          {/* 직무 */}
          {maker.main_job && maker.main_job.length > 0 && (
            <div className="mb-3">
              <span className="text-sm font-semibold text-gray-700 mb-2 block">직무</span>
              <div className="flex flex-wrap gap-2">
                {maker.main_job.slice(0, 5).map((job, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium border border-blue-200"
                  >
                    {job}
                  </span>
                ))}
                {maker.main_job.length > 5 && (
                  <span className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium">
                    +{maker.main_job.length - 5}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* 전문분야 */}
          {maker.expertise && maker.expertise.length > 0 && (
            <div>
              <span className="text-sm font-semibold text-gray-700 mb-2 block">전문분야</span>
              <div className="flex flex-wrap gap-2">
                {maker.expertise.slice(0, 5).map((exp, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg text-sm font-medium border border-purple-200"
                  >
                    {exp}
                  </span>
                ))}
                {maker.expertise.length > 5 && (
                  <span className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium">
                    +{maker.expertise.length - 5}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
