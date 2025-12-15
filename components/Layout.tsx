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
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    // 모바일 감지
    const checkMobile = () => {
      const isMobileDevice = window.innerWidth < 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      setIsMobile(isMobileDevice)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

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
    { href: '/recommendations', label: '추천 상품', tab: 'recommended' },
    { href: '/recommendations', label: '부진 상품', tab: 'excluded' },
    { href: '/similar-stores', label: '유사 매장 리포팅' },
  ]

  // recommendations 페이지일 때 서브 탭
  const isRecommendationsPage = pathname === '/recommendations'
  const currentTab = searchParams.get('tab') || 'recommended'

  const getTabHref = (tab: string) => {
    const baseHref = '/recommendations'
    if (storeCode) {
      return `${baseHref}?storeCode=${encodeURIComponent(storeCode)}&tab=${tab}`
    }
    return `${baseHref}?tab=${tab}`
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* 모바일 앱 스타일: 최상단 유틸리티 바 - 간단하게 */}
      {isMobile && storeCode && (
        <div className="bg-white px-4 py-2 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {storeName || '매장 정보'}
            </div>
            <Link
              href="/"
              className="text-sm text-gray-600"
            >
              로그아웃
            </Link>
          </div>
        </div>
      )}

      {/* 웹 스타일: 최상단 유틸리티 바 - 로그아웃 | 우리 매장 */}
      {!isMobile && storeCode && (
        <div className="bg-white px-4 md:px-6 lg:px-8 py-2">
          <div className="flex justify-end">
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
        </div>
      )}

      {/* 모바일 앱 스타일: 간단한 헤더 */}
      {isMobile && (
        <header className="bg-white border-b border-gray-200 px-4 py-3">
          <div className="flex items-center justify-center">
            <img 
              src="https://blog.kakaocdn.net/dna/Rgfiv/btqwQkfumoF/AAAAAAAAAAAAAAAAAAAAAGAZR8R47RTmlda6WEeNVxz2_krzlzUMSYBVH6e7ZgSg/img.jpg?credential=yqXZFxpELC7KVnFOS48ylbz2pIh7yKj8&expires=1767193199&allow_ip=&allow_referer=&signature=xLd%2FpHndt%2BLco2Mpc2IeZmW7nZc%3D"
              alt="7-ELEVEN"
              className="h-8 object-contain select-none"
              draggable="false"
            />
          </div>
        </header>
      )}

      {/* 웹 스타일: 메인 헤더 - 로고 및 네비게이션 */}
      {!isMobile && (
        <header className="bg-white border-b border-gray-200 px-4 md:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="ml-16 flex items-center">
                <img 
                  src="https://blog.kakaocdn.net/dna/Rgfiv/btqwQkfumoF/AAAAAAAAAAAAAAAAAAAAAGAZR8R47RTmlda6WEeNVxz2_krzlzUMSYBVH6e7ZgSg/img.jpg?credential=yqXZFxpELC7KVnFOS48ylbz2pIh7yKj8&expires=1767193199&allow_ip=&allow_referer=&signature=xLd%2FpHndt%2BLco2Mpc2IeZmW7nZc%3D"
                  alt="7-ELEVEN"
                  className="h-8 md:h-10 object-contain select-none"
                  draggable="false"
                />
              </div>
              
              {/* 네비게이션 메뉴 */}
              <nav className="hidden md:flex items-center gap-2 text-lg">
                <Link
                  href={getNavHref('/overview')}
                  className={`px-3 py-2 transition-colors ${
                    pathname === '/overview'
                      ? 'bg-green-500 text-white rounded-md'
                      : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  서비스 개요
                </Link>
                <span className="text-gray-400">|</span>
                <Link
                  href={getTabHref('recommended')}
                  className={`px-3 py-2 transition-colors ${
                    isRecommendationsPage && currentTab === 'recommended'
                      ? 'bg-green-500 text-white rounded-md'
                      : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  추천 상품
                </Link>
                <span className="text-gray-400">|</span>
                <Link
                  href={getTabHref('excluded')}
                  className={`px-3 py-2 transition-colors ${
                    isRecommendationsPage && currentTab === 'excluded'
                      ? 'bg-green-500 text-white rounded-md'
                      : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  부진 상품
                </Link>
                <span className="text-gray-400">|</span>
                <Link
                  href={getNavHref('/similar-stores')}
                  className={`px-3 py-2 transition-colors ${
                    pathname === '/similar-stores'
                      ? 'bg-green-500 text-white rounded-md'
                      : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  유사 매장 리포팅
                </Link>
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
          </div>
        </header>
      )}

      {/* 웹 스타일: 모바일 메뉴 오버레이 (데스크톱에서는 숨김) */}
      {!isMobile && isMenuOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setIsMenuOpen(false)}
        />
      )}

      {/* 웹 스타일: 모바일 사이드 메뉴 (데스크톱에서는 숨김) */}
      {!isMobile && (
        <aside
          className={`${
            isMenuOpen ? 'translate-x-0' : '-translate-x-full'
          } md:hidden fixed inset-y-0 left-0 z-50 w-64 bg-gray-50 border-r border-gray-200 flex-shrink-0 transition-transform duration-300 ease-in-out`}
        >
          <div className="p-4 md:p-6 h-full overflow-y-auto">
            <nav className="space-y-2">
              {navItems.map((item, index) => {
                const isActive = pathname === item.href && (!item.tab || (isRecommendationsPage && currentTab === item.tab))
                let href = getNavHref(item.href)
                if (item.tab) {
                  href = getTabHref(item.tab)
                }
                return (
                  <Link
                    key={`${item.href}-${item.tab || index}`}
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
      )}

      {/* 메인 컨텐츠 */}
      <main className={`flex-1 overflow-auto bg-white w-full ${isMobile ? 'pb-20' : ''}`}>
        {children}
      </main>

      {/* 모바일 앱 스타일: 하단 네비게이션 바 */}
      {isMobile && (
        <nav className="fixed bottom-0 left-0 right-0 bg-black text-white z-50 md:hidden">
          <div className="flex items-center justify-around py-2">
            <Link
              href={getNavHref('/overview')}
              className={`flex flex-col items-center justify-center px-4 py-2 ${pathname === '/overview' ? 'text-green-400' : 'text-white'}`}
            >
              <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              <span className="text-xs">홈</span>
            </Link>
            
            <Link
              href={getTabHref('recommended')}
              className={`flex flex-col items-center justify-center px-4 py-2 ${isRecommendationsPage && currentTab === 'recommended' ? 'text-green-400' : 'text-white'}`}
            >
              <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-xs">추천</span>
            </Link>
            
            <Link
              href={getTabHref('excluded')}
              className={`flex flex-col items-center justify-center px-4 py-2 ${isRecommendationsPage && currentTab === 'excluded' ? 'text-green-400' : 'text-white'}`}
            >
              <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="text-xs">부진</span>
            </Link>
            
            <Link
              href={getNavHref('/similar-stores')}
              className={`flex flex-col items-center justify-center px-4 py-2 ${pathname === '/similar-stores' ? 'text-green-400' : 'text-white'}`}
            >
              <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-xs">매장</span>
            </Link>
            
            <div className="flex flex-col items-center justify-center px-4 py-2 text-white">
              <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              <span className="text-xs">더보기</span>
            </div>
          </div>
        </nav>
      )}
    </div>
  )
}

