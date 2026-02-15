import React from 'react'
import { ArrowRight, Heart, Utensils, Users, Search } from 'lucide-react'
import Link from 'next/link'

const LandingPageCleint = () => {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="relative py-20 bg-gradient-to-r from-orange-500 to-red-600">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center text-white">
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              관심사로 연결되는 특별한 식사
            </h1>
            <p className="text-xl mb-8">
              당신의 취미와 관심사가 맞는 사람들과 함께하는 맛있는 시간
            </p>
            <a
              href="https://docs.google.com/forms/d/1EW3HgQgg4XmL1q2wMunl8J5c4hBZBqQp38mgYA-qPpY/edit?hl=ko"
              target="_blank"
              rel="noopener noreferrer"
            >
              <button className="bg-white text-red-600 px-8 py-3 rounded-full font-semibold flex items-center mx-auto hover:bg-red-50 transition-colors">
                모임 찾아보기
                <ArrowRight className="ml-2 h-5 w-5" />
              </button>
            </a>
          </div>
        </div>
      </section>

      {/* Keywords Section */}
      <section className="py-12 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap justify-center gap-3">
            {[
              '#여행',
              '#음악',
              '#영화',
              '#독서',
              '#요리',
              '#게임',
              '#운동',
              '#투자',
            ].map((tag) => (
              <span
                key={tag}
                className="px-4 py-2 bg-white rounded-full text-gray-700 shadow-sm"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">서비스 특징</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard
              icon={<Heart className="h-8 w-8" />}
              title="관심사 기반 매칭"
              description="공통 관심사를 가진 사람들과 자연스러운 대화를 나눠보세요"
            />
            <FeatureCard
              icon={<Utensils className="h-8 w-8" />}
              title="엄선된 레스토랑"
              description="분위기 좋은 레스토랑에서 즐거운 식사와 대화를 함께"
            />
            <FeatureCard
              icon={<Users className="h-8 w-8" />}
              title="다양한 모임"
              description="2-6인 소규모 모임부터 특별한 테마 모임까지"
            />
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">이용 방법</h2>
          <div className="max-w-4xl mx-auto">
            <StepCard
              number="1"
              title="관심사 선택"
              description="당신이 관심있는 주제와 키워드를 선택해주세요"
            />
            <StepCard
              number="2"
              title="모임 검색"
              description="원하는 날짜와 지역의 모임을 찾아보세요"
            />
            <StepCard
              number="3"
              title="예약하기"
              description="마음에 드는 모임을 선택하고 간편하게 예약하세요"
            />
          </div>
        </div>
      </section>

      {/* Restaurant Preview Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">
            이런 레스토랑에서 만나요
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <RestaurantCard
              image="/api/placeholder/400/300"
              type="이탈리안"
              description="분위기 좋은 파스타 전문점"
            />
            <RestaurantCard
              image="/api/placeholder/400/300"
              type="한식"
              description="모던한 한식 다이닝"
            />
            <RestaurantCard
              image="/api/placeholder/400/300"
              type="와인바"
              description="와인과 함께하는 안주 메뉴"
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-6">
            새로운 관심사 모임 시작하기
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            맛있는 식사와 함께 특별한 대화를 나눠보세요
          </p>
          <button className="bg-red-600 text-white px-8 py-3 rounded-full font-semibold flex items-center mx-auto hover:bg-red-700 transition-colors">
            모임 찾기
            <Search className="ml-2 h-5 w-5" />
          </button>
        </div>
      </section>
    </div>
  )
}

const FeatureCard = ({ icon, title, description }) => {
  return (
    <div className="text-center p-6 rounded-lg bg-white shadow-lg">
      <div className="text-red-600 mb-4 flex justify-center">{icon}</div>
      <h3 className="text-xl font-semibold mb-3">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  )
}

const StepCard = ({ number, title, description }) => {
  return (
    <div className="flex items-start mb-8">
      <div className="w-12 h-12 rounded-full bg-red-600 text-white flex items-center justify-center font-bold text-xl flex-shrink-0">
        {number}
      </div>
      <div className="ml-6">
        <h3 className="text-xl font-semibold mb-2">{title}</h3>
        <p className="text-gray-600">{description}</p>
      </div>
    </div>
  )
}

const RestaurantCard = ({ image, type, description }) => {
  return (
    <div className="rounded-lg overflow-hidden shadow-lg bg-white">
      <img
        src={image}
        alt={type}
        className="w-full h-48 object-cover"
      />
      <div className="p-4">
        <h3 className="text-xl font-semibold mb-2">{type}</h3>
        <p className="text-gray-600">{description}</p>
      </div>
    </div>
  )
}

export default LandingPageCleint
