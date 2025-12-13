'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [storeCode, setStoreCode] = useState('')
  const router = useRouter()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const code = storeCode.trim()
    if (code && code.length === 5 && /^\d+$/.test(code)) {
      // sessionStorage에 storeCode 저장
      sessionStorage.setItem('storeCode', code)
      router.push(`/overview?storeCode=${encodeURIComponent(code)}`)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 5)
    setStoreCode(value)
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
                placeholder="점포 코드를 입력하세요"
                className="w-full px-4 py-3 md:py-3.5 bg-gray-100 border-0 rounded-lg text-base text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-400 transition-all"
                required
                maxLength={5}
              />
            </div>

            <button
              type="submit"
              className="w-full px-6 py-3.5 md:py-4 bg-green-500 hover:bg-green-600 text-white font-semibold text-base rounded-lg transition-all shadow-md hover:shadow-lg active:scale-95"
            >
              로그인 하기
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

