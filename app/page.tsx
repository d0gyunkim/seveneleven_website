'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const [storeCode, setStoreCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    
    try {
      const code = storeCode.trim()
      
      if (!code) {
        setError('점포 코드를 입력해주세요.')
        setLoading(false)
        return
      }
      
      if (code.length !== 5) {
        setError('점포 코드는 5자리 숫자여야 합니다.')
        setLoading(false)
        return
      }
      
      if (!/^\d+$/.test(code)) {
        setError('점포 코드는 숫자만 입력 가능합니다.')
        setLoading(false)
        return
      }
      
      // 매장 코드가 데이터베이스에 존재하는지 확인
      const codeVariants = [code, code.toString(), parseInt(code).toString()]
      let storeExists = false
      
      for (const codeVariant of codeVariants) {
        const { data, error: storeError } = await supabase
          .from('매장마스터')
          .select('store_code')
          .eq('store_code', String(codeVariant))
          .limit(1)
        
        if (!storeError && data && data.length > 0) {
          storeExists = true
          break
        }
      }
      
      // 매장 코드가 존재하지 않으면 로그인 차단
      if (!storeExists) {
        setError('해당 매장 정보를 찾을 수 없습니다. 다시 입력해주세요.')
        setLoading(false)
        return
      }
      
      // sessionStorage에 storeCode 저장
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('storeCode', code)
      }
      
      // 페이지 이동
      router.push(`/overview?storeCode=${encodeURIComponent(code)}`)
    } catch (err) {
      console.error('Login error:', err)
      setError('로그인 중 오류가 발생했습니다. 다시 시도해주세요.')
      setLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 5)
    setStoreCode(value)
    setError('') // 입력 시 에러 메시지 초기화
  }

  return (
    <div
      className="min-h-screen bg-white flex flex-col items-center justify-center p-4 md:p-8 app-shell overflow-x-hidden safe-area-padding"
      style={{ fontFamily: 'Pretendard, sans-serif' }}
    >
      <div className="w-full max-w-md">
        {/* 상단 로고 영역 */}
        <div className="text-center mb-8 md:mb-12">
          <div className="flex items-center justify-center mb-3 md:mb-4">
            <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-blue-400 rounded-full mr-2"></div>
            <div className="text-4xl md:text-6xl font-bold bg-gradient-to-b from-blue-400 to-green-500 bg-clip-text text-transparent">
              7
            </div>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">세븐일레븐</h1>
          <p className="text-sm md:text-base text-gray-600 px-2 leading-relaxed">매주 내 매장과 유사한 매장에서<br className="sm:hidden"/>잘 팔리는 상품 추천</p>
        </div>

        {/* 환영 메시지 */}
        <div className="text-center mb-6 md:mb-8">
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">어서오세요 점주님!</h2>
          <p className="text-sm text-gray-600">매장 코드로 로그인하세요</p>
        </div>

        {/* 로그인 섹션 */}
        <div className="mb-6 md:mb-8">
          <form onSubmit={handleSubmit} className="space-y-4 md:space-y-5">
            <div>
              <input
                id="storeCode"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={storeCode}
                onChange={handleInputChange}
                placeholder="점포 코드를 입력하세요 (5자리 숫자)"
                className={`w-full min-h-[52px] px-4 py-3.5 md:py-4 bg-gray-50 border-2 rounded-xl text-base text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 transition-all ${
                  error ? 'border-red-400 focus:ring-red-400 focus:border-red-400' : 'border-gray-200 focus:ring-green-400 focus:border-green-400'
                }`}
                required
                maxLength={5}
                disabled={loading}
                autoComplete="off"
              />
              {error && (
                <p className="mt-2 text-sm text-red-500">{error}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-[48px] px-6 py-3.5 md:py-4 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold text-base rounded-xl transition-all shadow-md hover:shadow-lg active:scale-[0.98] flex items-center justify-center gap-2"
            >
              {loading && (
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              <span>{loading ? '확인 중...' : '로그인 하기'}</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

