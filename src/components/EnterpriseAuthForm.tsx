'use client'

import React, { useState } from 'react'
import { createSupabaseBrowserClient } from '@/supabase/supabase-client'
import MakersLogo from './common/MakersLogo'

interface EnterpriseAuthFormProps {
  onSuccess?: () => void
}

const EnterpriseAuthForm: React.FC<EnterpriseAuthFormProps> = ({ onSuccess }) => {
  const [isLogin, setIsLogin] = useState(true)
  const [formData, setFormData] = useState({
    companyName: '',
    contactName: '',
    email: '',
    phone: '',
    password: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  const supabase = createSupabaseBrowserClient()

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      if (isLogin) {
        // 로그인 로직
        const { data, error } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        })

        if (error) throw error

        if (!data.user?.id) {
          throw new Error('사용자 정보를 가져올 수 없습니다.')
        }

        // 기업 계정인지 확인 (client 테이블)
        const { data: clientData } = await supabase
          .from('client')
          .select('*')
          .eq('user_id', data.user.id)
          .maybeSingle()

        // accounts 테이블에서 COMPANY 프로필 확인
        const { data: companyProfile } = await supabase
          .from('accounts')
          .select('*')
          .eq('user_id', data.user.id)
          .eq('profile_type', 'COMPANY')
          .is('deleted_at', null)
          .maybeSingle()

        // client 테이블에 없거나 COMPANY 프로필이 없는 경우
        if (!clientData && !companyProfile) {
          throw new Error('기업 계정이 아닙니다. 기업 회원가입을 먼저 진행해주세요.')
        }

        // client 테이블은 있지만 COMPANY 프로필이 없는 경우, 프로필 생성
        if (clientData && !companyProfile) {
          // 먼저 모든 프로필을 비활성화 (프로필 전환을 위해)
          await supabase
            .from('accounts')
            .update({ is_active: false })
            .eq('user_id', data.user.id)
            .is('deleted_at', null)

          const userName = clientData.company_name || 
                          formData.email?.split('@')[0] || 
                          `company_${data.user.id.slice(0, 8)}`

          const { error: profileError } = await supabase
            .from('accounts')
            .upsert({
              user_id: data.user.id,
              username: userName,
              profile_type: 'COMPANY',
              bio: '',
              role: 'MANAGER',
              main_job: [],
              expertise: [],
              badges: [],
              is_active: true,
              availability_status: 'available',
              profile_created_at: new Date().toISOString()
            }, { 
              onConflict: 'user_id,profile_type',
              ignoreDuplicates: false
            })

          if (profileError) {
            console.error('프로필 생성 실패:', profileError)
            throw new Error('기업 프로필 생성에 실패했습니다. 관리자에게 문의해주세요.')
          }
        } else if (companyProfile && !companyProfile.is_active) {
          // COMPANY 프로필이 있지만 비활성화된 경우, 활성화
          // 먼저 모든 프로필을 비활성화
          await supabase
            .from('accounts')
            .update({ is_active: false })
            .eq('user_id', data.user.id)
            .is('deleted_at', null)

          // COMPANY 프로필을 활성화
          await supabase
            .from('accounts')
            .update({ 
              is_active: true,
              updated_at: new Date().toISOString()
            })
            .eq('user_id', data.user.id)
            .eq('profile_type', 'COMPANY')
            .is('deleted_at', null)
        }

        onSuccess?.()
      } else {
        // 회원가입 로직
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
        })

        if (authError) throw authError

        if (authData.user) {
          // 기업 계정 정보 저장
          const { error: clientError } = await supabase
            .from('client')
            .insert({
              user_id: authData.user.id,
              company_name: formData.companyName,
              contact_info: formData.phone,
              email: formData.email,
            })

          if (clientError) throw clientError

          // accounts 테이블에 COMPANY 프로필 자동 생성 (OAuth 콜백과 동일한 로직 사용)
          const userName = formData.companyName || 
                          formData.email?.split('@')[0] || 
                          `company_${authData.user.id.slice(0, 8)}`

          // upsert를 사용하여 중복 방지 및 일관성 유지
          const { error: profileError } = await supabase
            .from('accounts')
            .upsert({
              user_id: authData.user.id,
              username: userName,
              profile_type: 'COMPANY',
              bio: '',
              role: 'MANAGER',
              main_job: [],
              expertise: [],
              badges: [],
              is_active: true,
              availability_status: 'available',
              profile_created_at: new Date().toISOString()
            }, { 
              // UNIQUE (user_id, profile_type) 제약조건에 맞춰 onConflict 수정
              onConflict: 'user_id,profile_type',
              ignoreDuplicates: false
            })

          if (profileError) {
            console.error('프로필 생성 실패:', profileError)
            // 프로필 생성 실패해도 가입은 성공으로 처리
          }

          alert('회원가입이 완료되었습니다. 이메일을 확인해주세요.')
          setIsLogin(true)
        }
      }
    } catch (error: any) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md mx-auto px-6">
      {/* 헤더 */}
      <div className="text-center mb-8">
        <div className="flex justify-center mb-4">
          <MakersLogo size="lg" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {isLogin ? '기업 로그인' : '기업 회원가입'}
        </h1>
        <p className="text-gray-600">
          {isLogin ? '기업 계정으로 로그인하세요' : '기업 정보를 입력해주세요'}
        </p>
      </div>

      {/* 폼 */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {!isLogin && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                회사명 *
              </label>
              <input
                type="text"
                name="companyName"
                value={formData.companyName}
                onChange={handleInputChange}
                required={!isLogin}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="회사명을 입력하세요"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                담당자 이름 *
              </label>
              <input
                type="text"
                name="contactName"
                value={formData.contactName}
                onChange={handleInputChange}
                required={!isLogin}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="담당자 이름을 입력하세요"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                연락처 *
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                required={!isLogin}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="연락처를 입력하세요"
              />
            </div>
          </>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            이메일 *
          </label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleInputChange}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="이메일을 입력하세요"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            비밀번호 *
          </label>
          <input
            type="password"
            name="password"
            value={formData.password}
            onChange={handleInputChange}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="비밀번호를 입력하세요"
          />
        </div>

        {error && (
          <div className="text-red-600 text-sm text-center">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {loading ? '처리 중...' : (isLogin ? '로그인' : '회원가입')}
        </button>
      </form>

      {/* 소셜 로그인 */}
      <div className="mt-6">
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">또는</span>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            onClick={async () => {
              await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                  redirectTo: `${window.location.origin}/auth/callback?profile_type=COMPANY&next=/enterprise`,
                  // Google OAuth: 항상 계정 선택 화면 표시
                  queryParams: { prompt: 'select_account' },
                },
              })
            }}
            className="w-full inline-flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            <span className="ml-2">Google</span>
          </button>

          <button
            onClick={async () => {
              await supabase.auth.signInWithOAuth({
                provider: 'kakao',
                options: {
                  redirectTo: `${window.location.origin}/auth/callback?profile_type=COMPANY&next=/enterprise`,
                },
              })
            }}
            className="w-full inline-flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-[#FEE500] text-sm font-medium text-gray-700 hover:bg-[#FDD835]"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#3C1E1E" d="M12 3C6.48 3 2 6.48 2 10.8c0 2.7 1.8 5.1 4.5 6.4L5.5 21l4.1-2.1c1.1.2 2.2.3 3.4.3 5.52 0 10-3.48 10-7.8S17.52 3 12 3z"/>
            </svg>
            <span className="ml-2">Kakao</span>
          </button>
        </div>
      </div>

      {/* 로그인/회원가입 전환 */}
      <div className="mt-6 text-center">
        <button
          onClick={() => setIsLogin(!isLogin)}
          className="text-blue-600 hover:text-blue-500 text-sm"
        >
          {isLogin ? '기업 회원가입' : '기업 로그인'}
        </button>
      </div>
    </div>
  )
}

export default EnterpriseAuthForm
