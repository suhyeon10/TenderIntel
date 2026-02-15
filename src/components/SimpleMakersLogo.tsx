import React from 'react'

interface SimpleMakersLogoProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const SimpleMakersLogo: React.FC<SimpleMakersLogoProps> = ({ size = 'md', className = '' }) => {
  const sizeClasses = {
    sm: 'w-20 h-6',
    md: 'w-28 h-8',
    lg: 'w-36 h-10'
  }

  return (
    <div className={`flex items-center ${sizeClasses[size]} ${className}`}>
      <svg 
        viewBox="0 0 112 32" 
        className="w-full h-full"
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* M 아이콘 */}
        <path 
          d="M4 24V4h3l4 12 4-12h3v20h-2V10l-3 8h-2l-3-8v14H4z" 
          fill="#3B82F6"
        />
        
        {/* Makers 텍스트 */}
        <text 
          x="20" 
          y="20" 
          fontFamily="system-ui, -apple-system, sans-serif" 
          fontSize="16" 
          fontWeight="700" 
          fill="#1E40AF"
        >
          Makers
        </text>
        
        {/* B2B 배지 */}
        <rect 
          x="75" 
          y="6" 
          width="32" 
          height="12" 
          rx="6" 
          fill="#3B82F6"
        />
        <text 
          x="91" 
          y="14" 
          fontFamily="system-ui, -apple-system, sans-serif" 
          fontSize="8" 
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

export default SimpleMakersLogo
