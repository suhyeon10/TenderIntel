import React from 'react'

interface MakersLogoProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const MakersLogo: React.FC<MakersLogoProps> = ({ size = 'md', className = '' }) => {
  const sizeClasses = {
    sm: 'w-24 h-8',
    md: 'w-32 h-10', 
    lg: 'w-40 h-12'
  }

  return (
    <div className={`flex items-center ${sizeClasses[size]} ${className}`}>
      <svg 
        viewBox="0 0 160 40" 
        className="w-full h-full"
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* M 아이콘 */}
        <path 
          d="M8 32V8h4l6 16 6-16h4v24h-3V14l-5 12h-2l-5-12v18H8z" 
          fill="#3B82F6"
        />
        
        {/* 기어 아이콘 */}
        <g transform="translate(30, 8)">
          <circle cx="12" cy="12" r="10" fill="#3B82F6" opacity="0.1"/>
          <path 
            d="M12 2l1.5 3h3l-2.5 2 1 3-2.5-2-2.5 2 1-3-2.5-2h3L12 2z" 
            fill="#3B82F6"
          />
          <circle cx="12" cy="12" r="3" fill="#3B82F6"/>
        </g>
        
        {/* Makers 텍스트 */}
        <text 
          x="50" 
          y="26" 
          fontFamily="system-ui, -apple-system, sans-serif" 
          fontSize="18" 
          fontWeight="700" 
          fill="#1E40AF"
        >
          Makers
        </text>
        
        {/* B2B 배지 */}
        <rect 
          x="110" 
          y="8" 
          width="40" 
          height="16" 
          rx="8" 
          fill="#3B82F6"
        />
        <text 
          x="130" 
          y="19" 
          fontFamily="system-ui, -apple-system, sans-serif" 
          fontSize="10" 
          fontWeight="600" 
          fill="white" 
          textAnchor="middle"
        >
          B2B
        </text>
      </svg>
    </div>
  )
}

export default MakersLogo
