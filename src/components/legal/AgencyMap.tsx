'use client'

import { Button } from '@/components/ui/button'
import { MapPin, Phone, Navigation, FileText, ExternalLink } from 'lucide-react'
import type { AgencyInfo } from '@/types/legal'

interface AgencyMapProps {
  agencyInfo: AgencyInfo
  onNavigate?: () => void
  onCall?: () => void
  onFileSubmission?: () => void
}

/**
 * 관할 기관 지도 및 정보 컴포넌트
 * 정적 지도 이미지를 중앙에 배치하여 시각적 효과 강조
 */
export function AgencyMap({ 
  agencyInfo, 
  onNavigate,
  onCall,
  onFileSubmission 
}: AgencyMapProps) {
  // 정적 지도 이미지 URL 생성
  const getStaticMapUrl = (lat: number, lng: number) => {
    // Google Maps Static API (API 키 필요)
    // return `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=15&size=600x400&markers=color:red%7C${lat},${lng}&key=YOUR_API_KEY`
    
    // 카카오맵 Static Map
    // return `https://dapi.kakao.com/v2/maps/staticmap?center=${lng},${lat}&level=3&w=600&h=400&markers=${lng},${lat}`
    
    // 네이버 지도 Static Map (임시)
    // return `https://naveropenapi.apigw.ntruss.com/map-static/v2/raster?w=600&h=400&center=${lng},${lat}&level=14&markers=type:d|size:mid|color:red|${lng},${lat}&X-NCP-APIGW-API-KEY-ID=YOUR_KEY`
    
    // 플레이스홀더 (실제 구현 시 위 API 중 하나 사용)
    return `https://via.placeholder.com/600x400/4A90E2/FFFFFF?text=${encodeURIComponent(agencyInfo.name)}`
  }

  const handleNavigate = () => {
    if (agencyInfo.coordinates) {
      const { lat, lng } = agencyInfo.coordinates
      // 네이버 지도 길찾기
      window.open(
        `https://map.naver.com/v5/directions/${lng},${lat},,place/${encodeURIComponent(agencyInfo.address)}`,
        '_blank'
      )
    }
    onNavigate?.()
  }

  const handleCall = () => {
    if (agencyInfo.tel) {
      window.location.href = `tel:${agencyInfo.tel}`
    }
    onCall?.()
  }

  const handleFileSubmission = () => {
    // 진정서 접수 페이지로 이동 (실제 구현 필요)
    onFileSubmission?.()
  }

  return (
    <div className="space-y-4">
      {/* 기관 이름 */}
      <div className="text-center">
        <h4 className="text-xl font-bold text-slate-800 mb-1">
          {agencyInfo.name}
        </h4>
        <p className="text-sm text-slate-600 flex items-center justify-center gap-2">
          <MapPin className="h-4 w-4" />
          {agencyInfo.address}
        </p>
      </div>

      {/* 지도 이미지 (중앙 배치) */}
      {agencyInfo.coordinates ? (
        <div className="relative rounded-xl overflow-hidden border-2 border-slate-200 shadow-lg">
          <img
            src={agencyInfo.map_image_url || getStaticMapUrl(agencyInfo.coordinates.lat, agencyInfo.coordinates.lng)}
            alt={`${agencyInfo.name} 위치`}
            className="w-full h-64 object-cover"
            onError={(e) => {
              // 이미지 로드 실패 시 플레이스홀더
              const target = e.target as HTMLImageElement
              target.src = `https://via.placeholder.com/600x400/E5E7EB/6B7280?text=${encodeURIComponent(agencyInfo.name + ' 위치')}`
            }}
          />
          {/* 마커 오버레이 (선택적) */}
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
            <div className="bg-red-500 rounded-full p-2 shadow-lg">
              <MapPin className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>
      ) : (
        <div className="relative rounded-xl overflow-hidden border-2 border-slate-200 shadow-lg bg-slate-100 h-64 flex items-center justify-center">
          <div className="text-center text-slate-500">
            <MapPin className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>지도 정보를 불러올 수 없습니다.</p>
          </div>
        </div>
      )}

      {/* 액션 버튼들 (하단) */}
      <div className="grid grid-cols-3 gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleNavigate}
          className="flex items-center justify-center gap-2 border-blue-200 text-blue-700 hover:bg-blue-50"
        >
          <Navigation className="h-4 w-4" />
          길찾기
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={handleCall}
          className="flex items-center justify-center gap-2 border-green-200 text-green-700 hover:bg-green-50"
        >
          <Phone className="h-4 w-4" />
          전화 걸기
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={handleFileSubmission}
          className="flex items-center justify-center gap-2 border-purple-200 text-purple-700 hover:bg-purple-50"
        >
          <FileText className="h-4 w-4" />
          진정서 접수
        </Button>
      </div>

      {/* 추가 정보 */}
      <div className="pt-3 border-t border-slate-200">
        <div className="flex items-center justify-between text-sm text-slate-600">
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4" />
            <span>{agencyInfo.tel || '전화번호 없음'}</span>
          </div>
          {agencyInfo.coordinates && (
            <a
              href={`https://map.naver.com/search/${encodeURIComponent(agencyInfo.address)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-blue-600 hover:text-blue-700"
            >
              <ExternalLink className="h-3 w-3" />
              <span>상세 정보</span>
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

