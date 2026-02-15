import React from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { CommonModal } from '@/components/ConfirmModal'
import { calculateTotalExperience } from '@/lib/transformExperienceDate'
import { ExternalLink, Star } from 'lucide-react'

interface Maker {
  username: string
  main_job: string[] | null
  expertise: string[] | null
  account_work_experiences: any[]
}

interface Bookmark {
  id: number
  maker_id: string
  maker: Maker
  proposal_status: boolean
}

interface BookmarkCardProps {
  bookmark: Bookmark
  onUnbookmark: (makerId: string) => void
  onPropose?: (makerId: string) => void
}

export const ManageableMakerCard = ({
  bookmark,
  onUnbookmark,
  onPropose,
}: BookmarkCardProps) => {
  const totalExp = bookmark.maker.account_work_experiences.length > 0
    ? calculateTotalExperience(bookmark.maker.account_work_experiences)
    : null

  return (
    <div className="flex flex-col md:flex-row shadow-sm border border-gray-200 bg-white rounded-lg gap-4 p-6 hover:shadow-md transition-shadow">
      {/* 메이커 정보 섹션 */}
      <div className="flex gap-4 items-start flex-1">
        {/* 프로필 이미지 */}
        <Link href={`/profile/${bookmark.maker.username}`} className="flex-shrink-0">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-xl font-bold hover:opacity-80 transition-opacity cursor-pointer">
            {bookmark.maker.username?.[0]?.toUpperCase() || '?'}
          </div>
        </Link>
        
        {/* 메이커 상세 정보 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between mb-2">
            <Link 
              href={`/profile/${bookmark.maker.username}`}
              className="hover:text-blue-600 transition-colors"
            >
              <h3 className="text-lg md:text-xl font-bold text-gray-900">
                {bookmark.maker.username}
              </h3>
            </Link>
            {totalExp && (
              <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-lg text-sm font-semibold whitespace-nowrap ml-2">
                경력 {totalExp.years}년 {totalExp.months}개월
              </span>
            )}
            {!totalExp && (
              <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-lg text-sm font-semibold whitespace-nowrap ml-2">
                신입
              </span>
            )}
          </div>

          {/* 경력 정보 */}
          <div className="text-sm text-gray-600 mb-3">
            {bookmark.maker.account_work_experiences.length > 0 && (
              <span className="text-gray-500">
                {bookmark.maker.account_work_experiences
                  .map((exp) => exp.company_name)
                  .filter(Boolean)
                  .join(', ')}
              </span>
            )}
          </div>

          {/* 주직무 */}
          {bookmark.maker.main_job && bookmark.maker.main_job.length > 0 && (
            <div className="mb-2">
              <span className="text-sm text-gray-500 mr-2">주직무:</span>
              <div className="inline-flex flex-wrap gap-2">
                {bookmark.maker.main_job.map((job, index) => (
                  <span
                    key={index}
                    className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-md"
                  >
                    {job}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 전문분야 */}
          {bookmark.maker.expertise && bookmark.maker.expertise.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {bookmark.maker.expertise.map((ex, index) => (
                <span
                  key={index}
                  className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded-md"
                >
                  {ex}
                </span>
              ))}
            </div>
          )}

          {/* 프로필 보기 링크 */}
          <Link 
            href={`/profile/${bookmark.maker.username}`}
            className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 mt-3"
          >
            프로필 보기
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* 액션 버튼 섹션 */}
      <div className="flex flex-col justify-center gap-3 md:w-auto w-full">
        {bookmark.proposal_status && (
          <div className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-sm font-medium text-center">
            제안 완료
          </div>
        )}
        <CommonModal
          trigger={
            <Button 
              variant="outline" 
              className="w-full md:w-[200px] h-[40px] text-sm"
            >
              <Star className="w-4 h-4 mr-2" />
              찜 취소하기
            </Button>
          }
          title="찜 취소"
          description="해당 메이커를 찜 목록에서 삭제하시겠습니까?"
          onConfirm={() => onUnbookmark(bookmark.maker_id)}
          confirmText="삭제"
        />
        {!bookmark.proposal_status && onPropose && (
          <Button
            className="w-full md:w-[200px] h-[40px] text-sm bg-blue-600 hover:bg-blue-700"
            onClick={() => onPropose(bookmark.maker_id)}
          >
            제안하기
          </Button>
        )}
      </div>
    </div>
  )
}
