'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'

export default function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [storeCode, setStoreCode] = useState<string | null>(null)

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

  const getNavHref = (href: string) => {
    // storeCode가 있고, 홈이 아닌 페이지라면 storeCode 파라미터 추가
    if (storeCode && href !== '/') {
      return `${href}?storeCode=${encodeURIComponent(storeCode)}`
    }
    return href
  }

  const navItems = [
    { href: '/', label: '홈' },
    { href: '/recommendations', label: '발주 추천' },
  ]

  return (
    <div className="min-h-screen bg-white flex flex-col lg:flex-row">
      {/* 모바일 헤더 */}
      <header className="lg:hidden bg-gray-50 border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <h1 className="text-xl font-bold text-green-500">세븐일레븐</h1>
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="p-2 text-gray-700 hover:bg-gray-100 rounded-lg"
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
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setIsMenuOpen(false)}
        />
      )}

      {/* 왼쪽 네비게이션 */}
      <aside
        className={`${
          isMenuOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 fixed lg:static inset-y-0 left-0 z-50 w-64 bg-gray-50 border-r border-gray-200 flex-shrink-0 transition-transform duration-300 ease-in-out`}
      >
        <div className="p-4 md:p-6 h-full overflow-y-auto">
          <div className="hidden lg:block mb-8">
            <h1 className="text-xl md:text-2xl font-bold text-green-500">세븐일레븐</h1>
          </div>
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
    </div>
  )
}

