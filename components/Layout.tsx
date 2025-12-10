'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [storeCode, setStoreCode] = useState<string | null>(null)
  const [storeName, setStoreName] = useState<string | null>(null)

  useEffect(() => {
    // URL에서 storeCode 가져오기
    const code = searchParams.get('storeCode')
    if (code) {
      // URL에 storeCode가 있으면 sessionStorage에 저장
      sessionStorage.setItem('storeCode', code)
      setStoreCode(code)
    } else {
      // URL에 없으면 sessionStorage에서 가져오기
      const storedCode = sessionStorage.getItem('storeCode')
      if (storedCode) {
        setStoreCode(storedCode)
      }
    }
  }, [searchParams])

  useEffect(() => {
    // storeCode가 있으면 매장명 조회
    if (!storeCode) {
      setStoreName(null)
      return
    }

    const fetchStoreName = async () => {
      try {
        // 알려진 매장명 목록
        const knownStores = ['대치본점', '대치은마사거리점']
        
        for (const storeName of knownStores) {
          const recTable = `${storeName}_추천상품`
          
          // storecode를 문자열과 숫자 둘 다 시도
          const codeVariants = [storeCode, storeCode.toString(), parseInt(storeCode).toString()]
          
          for (const codeVariant of codeVariants) {
            const { data, error } = await supabase
              .from(recTable)
              .select('store_nm, store_code')
              .eq('store_code', codeVariant)
              .limit(1)

            if (!error && data && data.length > 0) {
              setStoreName(data[0].store_nm || storeName)
              return
            }
          }
        }
      } catch (err) {
        console.error('매장명 조회 오류:', err)
      }
    }

    fetchStoreName()
  }, [storeCode])

  const getNavHref = (href: string) => {
    // storeCode가 있고, 홈이 아닌 페이지라면 storeCode 파라미터 추가
    if (storeCode && href !== '/') {
      return `${href}?storeCode=${encodeURIComponent(storeCode)}`
    }
    return href
  }

  const navItems = [
    { href: '/overview', label: '서비스 개요' },
    { href: '/recommendations', label: '발주 추천' },
    { href: '/similar-stores', label: '유사매장' },
  ]

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* 상단 헤더 */}
      <header className="bg-gray-50 border-b border-gray-200 px-4 md:px-6 lg:px-8 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="ml-8 flex items-center">
            <img 
              src="https://blog.kakaocdn.net/dna/Rgfiv/btqwQkfumoF/AAAAAAAAAAAAAAAAAAAAAGAZR8R47RTmlda6WEeNVxz2_krzlzUMSYBVH6e7ZgSg/img.jpg?credential=yqXZFxpELC7KVnFOS48ylbz2pIh7yKj8&expires=1767193199&allow_ip=&allow_referer=&signature=xLd%2FpHndt%2BLco2Mpc2IeZmW7nZc%3D"
              alt="7-ELEVEN"
              className="h-8 md:h-10 object-contain select-none"
              draggable="false"
            />
          </div>
          
          {/* 네비게이션 메뉴 */}
          <nav className="hidden md:flex items-center gap-2">
            {navItems.map((item) => {
              const isActive = pathname === item.href
              const href = getNavHref(item.href)
              return (
                <Link
                  key={item.href}
                  href={href}
                  className={`px-5 py-2.5 text-base font-semibold rounded-md transition-colors ${
                    isActive
                      ? 'bg-green-500 text-white'
                      : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </div>

        {/* 모바일 메뉴 버튼 */}
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="md:hidden p-2 text-gray-700 hover:bg-gray-100 rounded-lg"
          aria-label="메뉴 열기"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {isMenuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </header>

      {/* 모바일 메뉴 오버레이 */}
      {isMenuOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setIsMenuOpen(false)}
        />
      )}

      {/* 모바일 사이드 메뉴 */}
      <aside
        className={`${
          isMenuOpen ? 'translate-x-0' : '-translate-x-full'
        } md:hidden fixed inset-y-0 left-0 z-50 w-64 bg-gray-50 border-r border-gray-200 flex-shrink-0 transition-transform duration-300 ease-in-out`}
      >
        <div className="p-4 md:p-6 h-full overflow-y-auto">
          <nav className="space-y-2">
            {navItems.map((item) => {
              const isActive = pathname === item.href
              const href = getNavHref(item.href)
              return (
                <Link
                  key={item.href}
                  href={href}
                  onClick={() => setIsMenuOpen(false)}
                  className={`block px-4 py-3 rounded-lg transition-colors text-base ${
                    isActive
                      ? 'bg-green-500 text-white'
                      : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </div>
      </aside>

      {/* 메인 컨텐츠 */}
      <main className="flex-1 overflow-auto bg-white w-full">
        {children}
      </main>

      {/* 오른쪽 사이드바 - 로그인 정보 */}
      {storeCode && (
        <aside className="hidden lg:block w-48 flex-shrink-0 bg-gray-50 border-l border-gray-200">
          <div className="p-4 h-full flex flex-col">
            {/* 상단 구분선 */}
            <div className="border-b border-orange-200 mb-4"></div>
            
            {/* 로그아웃 | 우리 매장 */}
            <div className="flex items-center gap-2 text-sm">
              <Link
                href="/"
                className="text-gray-700 hover:text-gray-900 transition-colors"
              >
                로그아웃
              </Link>
              <span className="text-gray-400">|</span>
              <div className="relative group">
                <button className="text-gray-700 hover:text-gray-900 transition-colors">
                  우리 매장
                </button>
                
                {/* 툴팁 콘텐츠 */}
                <div className="absolute right-0 top-full mt-2 w-64 p-4 bg-white rounded-lg border border-gray-200 shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                  <div className="space-y-2">
                    {storeName && (
                      <p className="text-sm text-gray-700 font-semibold">
                        매장: <span className="text-green-500">{storeName}</span>
                      </p>
                    )}
                    <p className="text-sm text-gray-700 font-semibold">
                      매장 코드: <span className="text-green-500">{storeCode}</span>
                    </p>
                    <p className="text-sm text-gray-700 font-semibold">
                      기준일자: <span className="text-green-500">2025년 9월 1일</span>
                    </p>
                  </div>
                  {/* 화살표 */}
                  <div className="absolute right-4 -top-2 w-0 h-0 border-l-8 border-l-transparent border-r-8 border-r-transparent border-b-8 border-b-gray-200"></div>
                  <div className="absolute right-[18px] -top-[7px] w-0 h-0 border-l-7 border-l-transparent border-r-7 border-r-transparent border-b-7 border-b-white"></div>
                </div>
              </div>
            </div>
          </div>
        </aside>
      )}
    </div>
  )
}

