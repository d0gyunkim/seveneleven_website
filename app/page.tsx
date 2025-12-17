'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

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
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4 md:p-8" style={{ fontFamily: 'Pretendard, sans-serif' }}>
      <div className="w-full max-w-md">
        {/* 상단 로고 영역 */}
        <div className="text-center mb-8 md:mb-12">
          <div className="flex items-center justify-center mb-3 md:mb-4">
            <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-blue-400 rounded-full mr-2"></div>
            <div className="text-4xl md:text-6xl font-bold bg-gradient-to-b from-blue-400 to-green-500 bg-clip-text text-transparent">
              7
            </div>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2">세븐일레븐</h1>
          <p className="text-xs md:text-sm text-gray-500 px-2">매주 내 매장과 유사한 매장에서 잘 팔리는 상품 추천</p>
        </div>

        {/* 환영 메시지 */}
        <div className="text-center mb-6 md:mb-8">
          <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-3 md:mb-4">어서오세요 점주님!</h2>
        </div>

        {/* 로그인 섹션 */}
        <div className="mb-4 md:mb-6">
          <h3 className="text-base md:text-lg font-medium text-green-500 mb-3 md:mb-4">로그인</h3>
          
          <form onSubmit={handleSubmit} className="space-y-3 md:space-y-4">
            <div>
              <input
                id="storeCode"
                type="text"
                value={storeCode}
                onChange={handleInputChange}
                placeholder="점포 코드를 입력하세요 (5자리 숫자)"
                className={`w-full px-4 py-3 md:py-3.5 bg-gray-100 border-0 rounded-lg text-base text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 transition-all ${
                  error ? 'focus:ring-red-400 ring-2 ring-red-400' : 'focus:ring-green-400'
                }`}
                required
                maxLength={5}
                disabled={loading}
              />
              {error && (
                <p className="mt-2 text-sm text-red-500">{error}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full px-6 py-3.5 md:py-4 bg-green-500 hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold text-base rounded-lg transition-all shadow-md hover:shadow-lg active:scale-95"
            >
              {loading ? '로그인 중...' : '로그인 하기'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

