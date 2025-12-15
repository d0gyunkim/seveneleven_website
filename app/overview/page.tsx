'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import Layout from '@/components/Layout'

export default function OverviewPage() {
  const [isVisible, setIsVisible] = useState(false)
  const [heroVisible, setHeroVisible] = useState(false)
  const [isApp, setIsApp] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const sectionRefs = useRef<(HTMLDivElement | null)[]>([])
  const buttonRefs = useRef<(HTMLDivElement | null)[]>([])
  const hasAppearedRef = useRef<Set<number>>(new Set())
  const searchParams = useSearchParams()
  const storeCode = searchParams.get('storeCode')

  // 앱 환경 감지
  useEffect(() => {
    const checkAppEnvironment = () => {
      // User-Agent로 앱 환경 감지
      const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera
      const isInApp = /wv|WebView|Android.*wv|iPhone.*wv/i.test(userAgent) || 
                      /standalone|fullscreen/i.test(userAgent) ||
                      window.matchMedia('(display-mode: standalone)').matches ||
                      (window.navigator as any).standalone === true
      
      // 모바일 환경 감지
      const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent) ||
                             window.innerWidth <= 768

      setIsApp(isInApp)
      setIsMobile(isMobileDevice)
    }

    checkAppEnvironment()
    window.addEventListener('resize', checkAppEnvironment)
    return () => window.removeEventListener('resize', checkAppEnvironment)
  }, [])

  // 첫 화면 텍스트 애니메이션
  useEffect(() => {
    const timer = setTimeout(() => {
      setHeroVisible(true)
    }, 100)
    return () => clearTimeout(timer)
  }, [])

  // 애플 스타일 스크롤 애니메이션
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY
      const windowHeight = window.innerHeight

      sectionRefs.current.forEach((section, index) => {
        if (!section) return

        const rect = section.getBoundingClientRect()
        const elementTop = rect.top
        const elementHeight = rect.height
        const elementCenter = elementTop + elementHeight / 2
        const viewportCenter = windowHeight / 2

        // 요소가 뷰포트에 들어왔는지 확인
        const isInViewport = elementTop < windowHeight && elementTop > -elementHeight

        if (isInViewport) {
          // 한번 나타났음을 표시
          hasAppearedRef.current.add(index)

          // 뷰포트 중심과의 거리 계산 (0 ~ 1)
          const distanceFromCenter = Math.abs(viewportCenter - elementCenter) / windowHeight
          const progress = Math.max(0, Math.min(1, 1 - distanceFromCenter * 2))

          // 앱 환경에서는 애니메이션 효과를 줄임
          if (isApp || isMobile) {
            // 더 부드러운 opacity와 transform 계산 (최소 opacity 보장, scale 제거)
            const opacity = Math.max(0.3, Math.min(1, progress))
            const translateY = (1 - progress) * 20

            section.style.opacity = opacity.toString()
            section.style.transform = `translateY(${translateY}px)`
            section.style.transition = 'opacity 0.3s ease-out, transform 0.3s ease-out'

            // 버튼도 함께 애니메이션 (더 부드럽게)
            if (buttonRefs.current[index]) {
              const buttonProgress = Math.max(0.3, Math.min(1, progress))
              buttonRefs.current[index]!.style.opacity = buttonProgress.toString()
              buttonRefs.current[index]!.style.transform = `translateY(${(1 - buttonProgress) * 15}px)`
              buttonRefs.current[index]!.style.transition = 'opacity 0.3s ease-out, transform 0.3s ease-out'
            }
          } else {
            // 데스크톱 환경: 기존 강한 애니메이션 (최소 opacity 보장, scale 제거)
            const opacity = Math.max(0.5, Math.min(1, progress * 1.5))
            const translateY = (1 - progress) * 50

            section.style.opacity = opacity.toString()
            section.style.transform = `translateY(${translateY}px)`
            section.style.transition = 'opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1), transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)'

            // 버튼도 함께 애니메이션
            if (buttonRefs.current[index]) {
              const buttonProgress = Math.max(0.3, Math.min(1, (progress - 0.3) * 1.5))
              buttonRefs.current[index]!.style.opacity = buttonProgress.toString()
              buttonRefs.current[index]!.style.transform = `translateY(${(1 - buttonProgress) * 30}px)`
              buttonRefs.current[index]!.style.transition = 'opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1), transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)'
            }
          }
        } else {
          // 뷰포트 밖에 있지만 이미 나타난 섹션은 그대로 유지
          if (hasAppearedRef.current.has(index)) {
            // 이미 나타난 섹션은 완전히 보이도록 유지
            section.style.opacity = '1'
            section.style.transform = 'translateY(0)'
            if (buttonRefs.current[index]) {
              buttonRefs.current[index]!.style.opacity = '1'
              buttonRefs.current[index]!.style.transform = 'translateY(0)'
            }
          } else {
            // 아직 나타나지 않은 섹션은 투명하게
            if (isApp || isMobile) {
              section.style.opacity = '0'
              section.style.transform = 'translateY(20px)'
              if (buttonRefs.current[index]) {
                buttonRefs.current[index]!.style.opacity = '0'
                buttonRefs.current[index]!.style.transform = 'translateY(15px)'
              }
            } else {
              section.style.opacity = '0'
              section.style.transform = 'translateY(50px)'
              if (buttonRefs.current[index]) {
                buttonRefs.current[index]!.style.opacity = '0'
                buttonRefs.current[index]!.style.transform = 'translateY(30px)'
              }
            }
          }
        }
      })
    }

    // 초기 실행
    handleScroll()

    // 스크롤 이벤트 리스너 (throttle 적용)
    let ticking = false
    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          handleScroll()
          ticking = false
        })
        ticking = true
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', handleScroll, { passive: true })

    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', handleScroll)
    }
  }, [isApp, isMobile])

  const getRecommendationsHref = () => {
    if (storeCode) {
      return `/recommendations?storeCode=${encodeURIComponent(storeCode)}&tab=recommended`
    }
    return '/recommendations?tab=recommended'
  }

  const getSimilarStoresHref = () => {
    if (storeCode) {
      return `/similar-stores?storeCode=${encodeURIComponent(storeCode)}`
    }
    return '/similar-stores'
  }

  const getUnderperformingHref = () => {
    if (storeCode) {
      return `/recommendations?storeCode=${encodeURIComponent(storeCode)}&tab=underperforming`
    }
    return '/recommendations?tab=underperforming'
  }

  return (
    <Layout>
      <div className="bg-white">
        {isApp || isMobile ? (
          /* 앱 환경: 애플 스타일 모바일 레이아웃 */
          <div className="min-h-screen bg-white">
            {/* 메인 콘텐츠 */}
            <main className="px-4 py-8 pb-24">
              {/* 첫 화면 - SEVEN PICK 헤더 */}
              <div className={`mb-8 transition-all duration-1000 ease-out ${
                heroVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
              }`}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-0.5 h-8 bg-green-200"></div>
                  <h1 className="text-2xl font-extrabold text-green-600">
                    SEVEN PICK:
                  </h1>
                </div>
                <h2 className="text-2xl font-extrabold text-gray-900 mb-4 leading-tight">
                  발주를 바꾸는 새로운 AI 추천
                </h2>
              </div>

              {/* 구분선 */}
              <div className="h-px bg-gray-200 mb-8"></div>

              {/* 섹션 0: SEVEN PICK 서비스 핵심 */}
              <section className="mb-12">
                <div
                  ref={(el) => { sectionRefs.current[0] = el }}
                  className="will-change-transform"
                  style={{ opacity: 0, transform: 'translateY(50px)' }}
                >
                  {/* STEP 0 헤더 */}
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-0.5 h-6 bg-green-200"></div>
                    <span className="text-green-600 font-semibold text-sm">STEP 0 서비스 핵심 요약</span>
                  </div>

                  {/* 메인 제목 */}
                  <h2 className="text-2xl font-extrabold text-gray-900 leading-tight mb-3">
                    SEVEN PICK: <span className="text-green-600">서비스 핵심</span>
                  </h2>
                  <p className="text-sm text-gray-600 mb-6 leading-relaxed">
                    발주에 대한 고민을 해결하기 위해 SEVEN PICK: 이 나섭니다.
                  </p>

                  {/* 메인 콘텐츠 영역 - 앱 UI */}
                  <div className="mb-8">
                    <div className="bg-white rounded-2xl overflow-hidden shadow-lg border border-gray-200">
                      {/* 모바일 헤더 */}
                      <div className="bg-gray-50 px-4 py-3 border-b flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">7-ELEVEN</span>
                        </div>
                        <div className="text-xs text-gray-500">15:15 Tue Dec 23</div>
                      </div>
                      
                      {/* 네비게이션 탭 */}
                      <div className="bg-white border-b">
                        <div className="flex overflow-x-auto">
                          <div className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">서비스 개요</div>
                          <div className="px-4 py-3 text-sm font-semibold bg-green-600 text-white whitespace-nowrap">추천 상품</div>
                          <div className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">부진 상품</div>
                          <div className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">유사 매장 리포팅</div>
                        </div>
                      </div>

                      {/* 메인 콘텐츠 */}
                      <div className="p-4">
                        <div className="mb-4">
                          <div className="text-sm font-semibold mb-2">대분류 카테고리</div>
                          <div className="flex flex-wrap gap-2">
                            {['과자', '냉장', '맥주', '면', '미반', '빵', '양주와인', '유음료', '음료'].map((cat, idx) => (
                              <button
                                key={cat}
                                className={`px-3 py-1 text-xs rounded-full ${
                                  idx === 0 ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700'
                                }`}
                              >
                                {cat}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="flex gap-4">
                          {/* 필터 */}
                          <div className="w-28 flex-shrink-0">
                            <div className="text-sm font-semibold mb-2">필터</div>
                            <div className="space-y-1 text-xs">
                              <div className="flex items-center gap-2">
                                <input type="radio" className="w-3 h-3" defaultChecked />
                                <span>전체(35)</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <input type="radio" className="w-3 h-3" defaultChecked />
                                <span>비스킷류</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <input type="radio" className="w-3 h-3" />
                                <span>스낵류</span>
                              </div>
                            </div>
                          </div>

                          {/* 상품 목록 */}
                          <div className="flex-1">
                            <div className="grid grid-cols-2 gap-2">
                              {[1, 2, 3, 4].map((i) => (
                                <div key={i} className="bg-gray-50 rounded-lg p-2">
                                  <div className="bg-gray-200 rounded h-20 mb-2 flex items-center justify-center text-xs text-gray-400">
                                    이미지 없음
                                  </div>
                                  <div className="text-xs font-medium mb-1 line-clamp-2">
                                    롯데)자일리톨알파오리지날용기86g
                                  </div>
                                  <div className="text-xs text-gray-600">6,000원</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 설명 텍스트 */}
                  <div className="space-y-3 text-gray-700 leading-relaxed">
                    <h3 className="text-xl font-bold text-gray-900 mb-3">
                      발주 추천 상품 안내
                    </h3>
                    <p className="text-sm">
                      내 매장과 비슷한 매장의 실제 판매 데이터를 학습하여 지금 필요한 상품을 추천합니다.
                    </p>
                    <p className="text-sm">
                      확인하고 싶은 대분류 카테고리를 선택하여 내가 원하는 상품군의 추천 상품만 확인할 수 있습니다.
                    </p>
                    <p className="text-sm">
                      추천 상품 클릭 시 해당 상품의 세부 정보 및 추천 근거를 확인할 수 있습니다.
                    </p>
                  </div>

                  {/* 하단 버튼들 */}
                  <div
                    ref={(el) => { buttonRefs.current[0] = el }}
                    className="flex flex-wrap justify-center gap-3 mt-8 will-change-transform"
                    style={{ opacity: 0, transform: 'translateY(30px)' }}
                  >
                    <Link
                      href={getSimilarStoresHref()}
                      className="px-6 py-3 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg transition-all duration-300 hover:bg-gray-200"
                    >
                      유사 매장 페이지
                    </Link>
                    <Link
                      href={getRecommendationsHref()}
                      className="px-6 py-3 text-sm font-medium text-white bg-gray-900 rounded-lg transition-all duration-300 hover:bg-gray-800"
                    >
                      추천 상품 페이지
                    </Link>
                    <Link
                      href={getUnderperformingHref()}
                      className="px-6 py-3 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg transition-all duration-300 hover:bg-gray-200"
                    >
                      부진 상품 페이지
                    </Link>
                  </div>
                </div>
              </section>

              {/* 구분선 */}
              <div className="h-px bg-gray-200 mb-16"></div>

              {/* 섹션 1: STEP 1 유사 매장 선별 */}
              <section className="mb-12 bg-gradient-to-br from-green-50 via-white to-green-50 -mx-4 px-4 py-8 rounded-2xl border border-green-100">
                <div
                  ref={(el) => { sectionRefs.current[1] = el }}
                  className="will-change-transform"
                  style={{ opacity: 0, transform: 'translateY(50px)' }}
                >
                  {/* STEP 1 헤더 */}
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-0.5 h-6 bg-green-600"></div>
                    <span className="text-green-600 font-semibold text-sm">STEP 1</span>
                    <span className="text-gray-700 font-semibold text-sm">유사 매장 선별</span>
                  </div>

                  {/* 메인 제목 */}
                  <div className="mb-4">
                    <h2 className="text-green-600 text-xl font-semibold mb-2">
                      유사 매장
                    </h2>
                    <h3 className="text-2xl font-bold text-gray-900 leading-tight mb-3">
                      나와 유사한 매장을 확인하세요.
                    </h3>
                  </div>

                  {/* 설명 텍스트 */}
                  <p className="text-sm text-gray-600 mb-6 leading-relaxed">
                    계속 변화하는 상권과 판매흐름을 포착하여 더 정확한, 더 완벽한 유사매장을 선별합니다.
                  </p>

                  {/* 선택 기준 카드들 */}
                  <div className="grid grid-cols-1 gap-3 mb-6">
                    <div className="bg-white rounded-xl p-4 border border-green-200 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <h4 className="text-sm font-semibold text-gray-900 mb-1">매장 판매 추세</h4>
                          <p className="text-xs text-gray-500">실시간 판매 데이터 분석</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white rounded-xl p-4 border border-green-200 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <h4 className="text-sm font-semibold text-gray-900 mb-1">유동 인구 3분위</h4>
                          <p className="text-xs text-gray-500">상권 유동인구 데이터 반영</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white rounded-xl p-4 border border-green-200 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <h4 className="text-sm font-semibold text-gray-900 mb-1">Rolling Window</h4>
                          <p className="text-xs text-gray-500">최근 4주 데이터 기반 분석</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 버튼 */}
                  <div
                    ref={(el) => { buttonRefs.current[1] = el }}
                    className="flex justify-center will-change-transform"
                    style={{ opacity: 0, transform: 'translateY(30px)' }}
                  >
                    <Link
                      href={getSimilarStoresHref()}
                      className="inline-flex items-center justify-center px-6 py-3 text-base font-medium text-white bg-green-600 rounded-lg transition-all duration-300 hover:bg-green-700 shadow-md hover:shadow-lg"
                    >
                      <span>유사 매장 알아보기</span>
                      <svg 
                        className="ml-2 w-5 h-5" 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  </div>
                </div>
              </section>

              {/* 구분선 */}
              <div className="h-px bg-gray-200 mb-12"></div>

              {/* 섹션 2: STEP 2 발주 추천 상품 확인 */}
              <section className="mb-12">
                <div
                  ref={(el) => { sectionRefs.current[2] = el }}
                  className="will-change-transform"
                  style={{ opacity: 0, transform: 'translateY(50px)' }}
                >
                  {/* STEP 2 헤더 */}
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-green-600 font-semibold text-sm">STEP 2</span>
                    <span className="text-gray-900 font-semibold text-sm">발주 추천 상품 확인</span>
                  </div>

                  {/* 메인 제목 */}
                  <div className="mb-4">
                    <h2 className="text-green-600 text-xl font-semibold mb-2">
                      추천 상품
                    </h2>
                    <h3 className="text-2xl font-bold text-gray-900 leading-tight mb-2">
                      추천 상품을 확인하세요.
                    </h3>
                    <h4 className="text-xl font-bold text-gray-900 leading-tight mb-3">
                      보다 편하고, 보다 자세하게.
                    </h4>
                  </div>

                  {/* 설명 텍스트 */}
                  <p className="text-sm text-gray-600 mb-6 leading-relaxed">
                    AI 딥러닝 알고리즘을 통해 내 매장에서 잘 팔릴 상품을 추천해드립니다.
                  </p>

                  {/* 상품 카드 그리드 */}
                  <div className="grid grid-cols-2 gap-4 mb-8">
                    {/* 상품 카드 1: 자일리톨 */}
                    <div className="bg-white border-2 border-gray-200 rounded-xl p-4 shadow-lg">
                      <div className="flex items-center justify-center h-32 mb-3 bg-gray-50 rounded-lg">
                        <div className="flex items-end gap-1">
                          {[1, 2, 3, 4, 5, 6].map((i) => (
                            <div 
                              key={i}
                              className="w-6 h-12 bg-white border-2 border-green-600 rounded-full flex items-center justify-center"
                              style={{ 
                                transform: i <= 4 ? 'translateY(0)' : 'translateY(-6px)',
                                zIndex: 7 - i
                              }}
                            >
                              <div className="w-4 h-10 bg-green-600 rounded-full"></div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="text-xs font-semibold text-gray-900 text-center">
                        XYLITOL α
                      </div>
                    </div>

                    {/* 상품 카드 2: 빼빼로 */}
                    <div className="bg-white border-2 border-gray-200 rounded-xl p-4 shadow-lg">
                      <div className="flex items-center justify-center h-32 mb-3 bg-yellow-50 rounded-lg">
                        <div className="w-24 h-28 bg-gradient-to-b from-yellow-400 to-yellow-600 rounded-lg shadow-md flex items-center justify-center">
                          <div className="text-white text-xs font-bold text-center px-2">
                            빼빼로<br />크런키
                          </div>
                        </div>
                      </div>
                      <div className="text-xs font-semibold text-gray-900 text-center">
                        LOTTE PEPERO
                      </div>
                    </div>

                    {/* 상품 카드 3: 치토스 & 꼬깔콘 */}
                    <div className="bg-white border-2 border-gray-200 rounded-xl p-4 shadow-lg">
                      <div className="flex flex-col items-center justify-center h-32 mb-3 bg-gray-50 rounded-lg p-3">
                        <div className="flex gap-1 mb-1">
                          <div className="w-12 h-16 bg-orange-500 rounded-lg"></div>
                          <div className="w-12 h-16 bg-orange-500 rounded-lg"></div>
                        </div>
                        <div className="flex gap-1">
                          <div className="w-10 h-12 bg-yellow-400 rounded-lg"></div>
                          <div className="w-10 h-12 bg-yellow-400 rounded-lg"></div>
                          <div className="w-10 h-12 bg-yellow-400 rounded-lg"></div>
                        </div>
                      </div>
                      <div className="text-xs font-semibold text-gray-900 text-center">
                        Cheetos & 꼬깔콘
                      </div>
                    </div>

                    {/* 상품 카드 4: Fruit-tella */}
                    <div className="bg-white border-2 border-gray-200 rounded-xl p-4 shadow-lg relative">
                      <div className="absolute top-2 right-2 bg-yellow-400 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold text-gray-900 z-10">
                        1개
                      </div>
                      <div className="flex items-center justify-center h-32 mb-3 bg-blue-50 rounded-lg">
                        <div className="w-24 h-28 bg-gradient-to-b from-blue-200 to-blue-400 rounded-lg shadow-md flex items-center justify-center">
                          <div className="text-white text-xs font-bold text-center">
                            Fruit-tella<br />YO!GURT
                          </div>
                        </div>
                      </div>
                      <div className="text-xs font-semibold text-gray-900 text-center">
                        Fruit-tella YOGURT
                      </div>
                    </div>
                  </div>

                  {/* 버튼 */}
                  <div
                    ref={(el) => { buttonRefs.current[2] = el }}
                    className="flex justify-center will-change-transform"
                    style={{ opacity: 0, transform: 'translateY(30px)' }}
                  >
                    <Link
                      href={getRecommendationsHref()}
                      className="inline-flex items-center justify-center px-6 py-3 text-base font-medium text-white bg-green-600 rounded-lg transition-all duration-300 hover:bg-green-700"
                    >
                      <span>추천 상품 확인하기</span>
                      <svg 
                        className="ml-2 w-5 h-5" 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  </div>
                </div>
              </section>

              {/* 구분선 */}
              <div className="h-px bg-gray-200 mb-12"></div>

              {/* 섹션 3: STEP 3 부진 상품 확인 */}
              <section className="mb-12">
                <div
                  ref={(el) => { sectionRefs.current[3] = el }}
                  className="will-change-transform"
                  style={{ opacity: 0, transform: 'translateY(50px)' }}
                >
                  {/* STEP 3 헤더 */}
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-0.5 h-6 bg-green-200"></div>
                    <span className="text-green-600 font-semibold text-sm">STEP 3</span>
                    <span className="text-gray-900 font-semibold text-sm">부진 상품 확인</span>
                  </div>

                  {/* 메인 제목 */}
                  <div className="mb-4">
                    <h2 className="text-green-600 text-xl font-semibold mb-2">
                      부진 상품
                    </h2>
                    <h3 className="text-2xl font-bold text-gray-900 leading-tight mb-3">
                      창고를 채우고 있는 부진 상품을 확인하세요.
                    </h3>
                  </div>

                  {/* 설명 텍스트 */}
                  <p className="text-sm text-gray-600 mb-6 leading-relaxed">
                    실제 발주 및 판매 데이터 분석을 통해 내 매장의 상품군별 부진 상품 현황을 알려드립니다.
                  </p>

                  {/* 쓰레기통 아이콘 */}
                  <div className="flex justify-center mb-8">
                    <div className="w-40 h-40 flex items-center justify-center relative">
                      <div className="absolute inset-0 bg-gradient-to-br from-gray-600 to-gray-800 rounded-lg transform rotate-3 shadow-2xl opacity-20"></div>
                      <div className="relative">
                        <svg 
                          className="w-full h-full text-gray-700" 
                          fill="currentColor" 
                          viewBox="0 0 24 24"
                          style={{ filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.3))' }}
                        >
                          <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" 
                            stroke="currentColor" 
                            strokeWidth="2" 
                            strokeLinecap="round" 
                            strokeLinejoin="round"
                            fill="none"
                          />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* 버튼 */}
                  <div
                    ref={(el) => { buttonRefs.current[3] = el }}
                    className="flex justify-center will-change-transform"
                    style={{ opacity: 0, transform: 'translateY(30px)' }}
                  >
                    <Link
                      href={getUnderperformingHref()}
                      className="inline-flex items-center justify-center px-6 py-3 text-base font-medium text-white bg-green-600 rounded-lg transition-all duration-300 hover:bg-green-700"
                    >
                      <span>부진 상품 확인하기</span>
                      <svg 
                        className="ml-2 w-5 h-5" 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  </div>
                </div>
              </section>
            </main>

            {/* 하단 브라우저 네비게이션 바 */}
            <div className="fixed bottom-0 left-0 right-0 bg-gray-900 bg-opacity-90 backdrop-blur-sm px-4 py-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
              <div className="flex-1 mx-4">
                <div className="bg-gray-700 rounded-lg px-3 py-1.5 text-xs text-gray-300 text-center">
                  seven-eleven.com
                </div>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </div>
            </div>
            <div className="h-16"></div>
          </div>
        ) : (
          /* 데스크톱 환경: 기존 레이아웃 */
          <>
            {/* 첫 화면 - 전체 화면 높이, SEVEN PICK 헤더만 표시 */}
            <div className="bg-white min-h-screen flex items-center justify-start px-4 md:px-6 lg:px-8">
              <div className="w-full">
                <div className={`flex items-center gap-4 transition-all duration-1000 ease-out ${
                  heroVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
                }`}>
                  {/* 왼쪽 얇은 연한 초록색 수직선 */}
                  <div className={`w-1 h-16 md:h-20 lg:h-24 bg-green-200 flex-shrink-0 transition-all duration-1000 delay-200 ${
                    heroVisible ? 'opacity-100 scale-y-100' : 'opacity-0 scale-y-0'
                  }`} style={{ transformOrigin: 'bottom' }}></div>
                  
                  {/* 텍스트 영역 */}
                  <div className="flex flex-col">
                    <h1 className={`text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-extrabold text-green-600 mb-2 leading-tight transition-all duration-1000 delay-300 ${
                      heroVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-8'
                    }`}>
                      SEVEN PICK:
                    </h1>
                    <h2 className={`text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-extrabold text-black leading-tight transition-all duration-1000 delay-500 ${
                      heroVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-8'
                    }`}>
                      발주를 바꾸는 새로운 AI 추천
                    </h2>
                  </div>
                </div>
              </div>
            </div>

        {/* 구분선 */}
        <div className="h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent"></div>

        {/* 섹션 0: SEVEN PICK 서비스 핵심 */}
        <section className="bg-white py-20 md:py-24 lg:py-28">
          <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
            <div
              ref={(el) => { sectionRefs.current[0] = el }}
              className="will-change-transform"
              style={{ opacity: 0, transform: 'translateY(50px)' }}
            >
              {/* STEP 0 헤더 */}
              <div className="flex items-center gap-3 mb-6">
                <div className="w-1 h-10 bg-green-200"></div>
                <span className="text-green-600 font-semibold text-base">STEP 0 서비스 핵심 요약</span>
              </div>

              {/* 메인 제목 */}
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-gray-900 leading-tight mb-4 tracking-tight">
                SEVEN PICK: <span className="text-green-600">서비스 핵심</span>
              </h2>
              <p className="text-lg md:text-xl text-gray-600 mb-12 leading-relaxed">
                발주에 대한 고민을 해결하기 위해 SEVEN PICK: 이 나섭니다.
              </p>

              {/* 메인 콘텐츠 영역 */}
              {isApp || isMobile ? (
                /* 앱 환경: 실제 앱 UI 표시 */
                <div className="max-w-md mx-auto">
                  <div className="bg-white rounded-2xl overflow-hidden shadow-2xl border-2 border-gray-200">
                    {/* 모바일 헤더 */}
                    <div className="bg-gray-50 px-4 py-3 border-b flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">7-ELEVEN</span>
                      </div>
                      <div className="text-xs text-gray-500">15:15 Tue Dec 23</div>
                    </div>
                    
                    {/* 네비게이션 탭 */}
                    <div className="bg-white border-b">
                      <div className="flex overflow-x-auto">
                        <div className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">서비스 개요</div>
                        <div className="px-4 py-3 text-sm font-semibold bg-green-600 text-white whitespace-nowrap">추천 상품</div>
                        <div className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">부진 상품</div>
                        <div className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">유사 매장 리포팅</div>
                      </div>
                    </div>

                    {/* 메인 콘텐츠 */}
                    <div className="p-4">
                      <div className="mb-4">
                        <div className="text-sm font-semibold mb-2">대분류 카테고리</div>
                        <div className="flex flex-wrap gap-2">
                          {['과자', '냉장', '맥주', '면', '미반', '빵', '양주와인', '유음료', '음료'].map((cat, idx) => (
                            <button
                              key={cat}
                              className={`px-3 py-1 text-xs rounded-full ${
                                idx === 0 ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700'
                              }`}
                            >
                              {cat}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex gap-4">
                        {/* 필터 */}
                        <div className="w-32 flex-shrink-0">
                          <div className="text-sm font-semibold mb-2">필터</div>
                          <div className="space-y-1 text-xs">
                            <div className="flex items-center gap-2">
                              <input type="radio" className="w-3 h-3" defaultChecked />
                              <span>전체(35)</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <input type="radio" className="w-3 h-3" defaultChecked />
                              <span>비스킷류</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <input type="radio" className="w-3 h-3" />
                              <span>스낵류</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <input type="radio" className="w-3 h-3" />
                              <span>젤리류</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <input type="radio" className="w-3 h-3" />
                              <span>초콜릿</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <input type="radio" className="w-3 h-3" />
                              <span>캔디류</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <input type="radio" className="w-3 h-3" />
                              <span>프로틴/시리얼</span>
                            </div>
                          </div>
                        </div>

                        {/* 상품 목록 */}
                        <div className="flex-1">
                          <div className="grid grid-cols-2 gap-3">
                            {[1, 2, 3, 4].map((i) => (
                              <div key={i} className="bg-gray-50 rounded-lg p-2">
                                <div className="bg-gray-200 rounded h-24 mb-2 flex items-center justify-center text-xs text-gray-400">
                                  이미지 없음
                                </div>
                                <div className="text-xs font-medium mb-1 line-clamp-2">
                                  롯데)자일리톨알파오리지날용기86g
                                </div>
                                <div className="text-xs text-gray-600">6,000원</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* 앱 환경 설명 텍스트 */}
                  <div className="mt-8 space-y-4 text-gray-700 leading-relaxed">
                    <h3 className="text-xl font-bold text-gray-900 mb-4">
                      발주 추천 상품 안내
                    </h3>
                    <p className="text-base">
                      내 매장과 비슷한 매장의 실제 판매 데이터를 학습하여 지금 필요한 상품을 추천합니다.
                    </p>
                    <p className="text-base">
                      확인하고 싶은 대분류 카테고리를 선택하여 내가 원하는 상품군의 추천 상품만 확인할 수 있습니다.
                    </p>
                    <p className="text-base">
                      추천 상품 클릭 시 해당 상품의 세부 정보 및 추천 근거를 확인할 수 있습니다.
                    </p>
                  </div>
                </div>
              ) : (
                /* 데스크톱 환경: 기존 레이아웃 */
                <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-start">
                  {/* 왼쪽: 모바일 UI 프리뷰 */}
                  <div className="relative">
                    <div className="bg-black rounded-3xl p-4 shadow-2xl">
                      <div className="bg-white rounded-2xl overflow-hidden">
                        {/* 모바일 헤더 */}
                        <div className="bg-gray-50 px-4 py-3 border-b flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold">7-ELEVEN</span>
                          </div>
                          <div className="text-xs text-gray-500">15:15 Tue Dec 23</div>
                        </div>
                        
                        {/* 네비게이션 탭 */}
                        <div className="bg-white border-b">
                          <div className="flex">
                            <div className="px-4 py-3 text-sm text-gray-600">서비스 개요</div>
                            <div className="px-4 py-3 text-sm font-semibold bg-green-600 text-white">추천 상품</div>
                            <div className="px-4 py-3 text-sm text-gray-600">부진 상품</div>
                            <div className="px-4 py-3 text-sm text-gray-600">유사 매장 리포팅</div>
                          </div>
                        </div>

                        {/* 메인 콘텐츠 */}
                        <div className="p-4">
                          <div className="mb-4">
                            <div className="text-sm font-semibold mb-2">대분류 카테고리</div>
                            <div className="flex flex-wrap gap-2">
                              {['과자', '냉장', '맥주', '면', '미반', '빵', '양주와인', '유음료', '음료'].map((cat, idx) => (
                                <button
                                  key={cat}
                                  className={`px-3 py-1 text-xs rounded-full ${
                                    idx === 0 ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700'
                                  }`}
                                >
                                  {cat}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="flex gap-4">
                            {/* 필터 */}
                            <div className="w-32">
                              <div className="text-sm font-semibold mb-2">필터</div>
                              <div className="space-y-1 text-xs">
                                <div className="flex items-center gap-2">
                                  <input type="radio" className="w-3 h-3" defaultChecked />
                                  <span>전체(35)</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <input type="radio" className="w-3 h-3" defaultChecked />
                                  <span>비스킷류</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <input type="radio" className="w-3 h-3" />
                                  <span>스낵류</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <input type="radio" className="w-3 h-3" />
                                  <span>젤리류</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <input type="radio" className="w-3 h-3" />
                                  <span>초콜릿</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <input type="radio" className="w-3 h-3" />
                                  <span>캔디류</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <input type="radio" className="w-3 h-3" />
                                  <span>프로틴/시리얼</span>
                                </div>
                              </div>
                            </div>

                            {/* 상품 목록 */}
                            <div className="flex-1">
                              <div className="grid grid-cols-2 gap-3">
                                {[1, 2, 3, 4].map((i) => (
                                  <div key={i} className="bg-gray-50 rounded-lg p-2">
                                    <div className="bg-gray-200 rounded h-24 mb-2 flex items-center justify-center text-xs text-gray-400">
                                      이미지 없음
                                    </div>
                                    <div className="text-xs font-medium mb-1 line-clamp-2">
                                      롯데)자일리톨알파오리지날용기86g
                                    </div>
                                    <div className="text-xs text-gray-600">6,000원</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 오른쪽: 설명 텍스트 */}
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
                        발주 추천 상품 안내
                      </h3>
                      <div className="space-y-4 text-gray-700 leading-relaxed">
                        <p className="text-lg">
                          내 매장과 비슷한 매장의 실제 판매 데이터를 학습하여 지금 필요한 상품을 추천합니다.
                        </p>
                        <p className="text-lg">
                          확인하고 싶은 대분류 카테고리를 선택하여 내가 원하는 상품군의 추천 상품만 확인할 수 있습니다.
                        </p>
                        <p className="text-lg">
                          추천 상품 클릭 시 해당 상품의 세부 정보 및 추천 근거를 확인할 수 있습니다.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 하단 버튼들 */}
              <div
                ref={(el) => { buttonRefs.current[0] = el }}
                className="flex flex-wrap justify-center gap-4 mt-16 will-change-transform"
                style={{ opacity: 0, transform: 'translateY(30px)' }}
              >
                <Link
                  href={getSimilarStoresHref()}
                  className="px-8 py-4 text-lg font-medium text-gray-700 bg-gray-100 rounded-lg transition-all duration-300 hover:bg-gray-200 hover:scale-105"
                >
                  유사 매장 페이지
                </Link>
                <Link
                  href={getRecommendationsHref()}
                  className="px-8 py-4 text-lg font-medium text-white bg-gray-900 rounded-lg transition-all duration-300 hover:bg-gray-800 hover:scale-105"
                >
                  추천 상품 페이지
                </Link>
                <Link
                  href={getUnderperformingHref()}
                  className="px-8 py-4 text-lg font-medium text-gray-700 bg-gray-100 rounded-lg transition-all duration-300 hover:bg-gray-200 hover:scale-105"
                >
                  부진 상품 페이지
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* 구분선 */}
        <div className="h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent"></div>

        {/* 섹션 1: STEP 1 유사 매장 선별 */}
        <section className="bg-gradient-to-br from-green-50 via-white to-green-50 py-20 md:py-24 lg:py-28 border-t border-b border-green-100">
          <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8">
            <div
              ref={(el) => { sectionRefs.current[1] = el }}
              className="will-change-transform"
              style={{ opacity: 0, transform: 'translateY(50px)' }}
            >
              {/* STEP 1 헤더 */}
              <div className="flex items-center gap-3 mb-6">
                <div className="w-1 h-10 bg-green-600"></div>
                <span className="text-green-600 font-semibold text-base">STEP 1</span>
                <span className="text-gray-700 font-semibold text-base">유사 매장 선별</span>
              </div>

              {/* 메인 제목 */}
              <div className="mb-4">
                <h2 className="text-green-600 text-2xl md:text-3xl font-semibold mb-3">
                  유사 매장
                </h2>
                <h3 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight mb-4">
                  나와 유사한 매장을 확인하세요.
                </h3>
              </div>

              {/* 설명 텍스트 */}
              <p className="text-lg md:text-xl text-gray-600 mb-12 leading-relaxed max-w-4xl">
                계속 변화하는 상권과 판매흐름을 포착하여 더 정확한, 더 완벽한 유사매장을 선별합니다.
              </p>

              {/* 선택 기준 카드들 */}
              <div className="grid md:grid-cols-3 gap-6 mb-12">
                <div className="bg-white rounded-xl p-6 border border-green-200 shadow-sm hover:shadow-lg transition-all duration-300 hover:border-green-300">
                  <div className="flex flex-col items-start">
                    <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mb-4">
                      <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-2">매장 판매 추세</h4>
                    <p className="text-sm text-gray-500 leading-relaxed">실시간 판매 데이터를 분석하여 유사한 판매 패턴을 가진 매장을 찾습니다.</p>
                  </div>
                </div>

                <div className="bg-white rounded-xl p-6 border border-green-200 shadow-sm hover:shadow-lg transition-all duration-300 hover:border-green-300">
                  <div className="flex flex-col items-start">
                    <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mb-4">
                      <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-2">유동 인구 3분위</h4>
                    <p className="text-sm text-gray-500 leading-relaxed">상권의 유동인구 데이터를 반영하여 더욱 정확한 상권 특성을 파악합니다.</p>
                  </div>
                </div>

                <div className="bg-white rounded-xl p-6 border border-green-200 shadow-sm hover:shadow-lg transition-all duration-300 hover:border-green-300">
                  <div className="flex flex-col items-start">
                    <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mb-4">
                      <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-2">Rolling Window</h4>
                    <p className="text-sm text-gray-500 leading-relaxed">최근 4주 데이터를 기반으로 상권의 변화를 실시간으로 포착합니다.</p>
                  </div>
                </div>
              </div>

              {/* 버튼 */}
              <div
                ref={(el) => { buttonRefs.current[1] = el }}
                className="flex justify-center will-change-transform"
                style={{ opacity: 0, transform: 'translateY(30px)' }}
              >
                <Link
                  href={getSimilarStoresHref()}
                  className="group relative inline-flex items-center justify-center px-8 py-4 text-lg font-medium text-white bg-green-600 rounded-lg transition-all duration-300 hover:bg-green-700 shadow-md hover:shadow-lg"
                >
                  <span>유사 매장 알아보기</span>
                  <svg 
                    className="ml-2 w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* 구분선 */}
        <div className="h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent"></div>

        {/* 섹션 2: STEP 2 발주 추천 상품 확인 */}
        <section className="bg-white py-20 md:py-24 lg:py-28">
          <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8">
            <div
              ref={(el) => { sectionRefs.current[2] = el }}
              className="will-change-transform"
              style={{ opacity: 0, transform: 'translateY(50px)' }}
            >
              {/* STEP 2 헤더 */}
              <div className="flex items-center gap-3 mb-6">
                <span className="text-green-600 font-semibold text-base">STEP 2</span>
                <span className="text-gray-900 font-semibold text-base">발주 추천 상품 확인</span>
              </div>

              {/* 메인 제목 */}
              <div className="mb-4">
                <h2 className="text-green-600 text-2xl md:text-3xl font-semibold mb-3">
                  추천 상품
                </h2>
                <h3 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight mb-3">
                  추천 상품을 확인하세요.
                </h3>
                <h4 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 leading-tight mb-4">
                  보다 편하고, 보다 자세하게.
                </h4>
              </div>

              {/* 설명 텍스트 */}
              <p className="text-lg md:text-xl text-gray-600 mb-12 leading-relaxed max-w-4xl">
                AI 딥러닝 알고리즘을 통해 내 매장에서 잘 팔릴 상품을 추천해드립니다.
              </p>

              {/* 상품 카드 그리드 */}
              <div className="grid grid-cols-2 gap-6 md:gap-8 mb-16 max-w-4xl mx-auto">
                {/* 상품 카드 1: 자일리톨 */}
                <div className="bg-white border-2 border-gray-200 rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow">
                  <div className="flex items-center justify-center h-48 mb-4 bg-gray-50 rounded-lg">
                    <div className="flex items-end gap-2">
                      {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div 
                          key={i}
                          className="w-8 h-16 bg-white border-2 border-green-600 rounded-full flex items-center justify-center"
                          style={{ 
                            transform: i <= 4 ? 'translateY(0)' : 'translateY(-8px)',
                            zIndex: 7 - i
                          }}
                        >
                          <div className="w-6 h-12 bg-green-600 rounded-full"></div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-gray-900 text-center">
                    XYLITOL α
                  </div>
                </div>

                {/* 상품 카드 2: 빼빼로 */}
                <div className="bg-white border-2 border-gray-200 rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow">
                  <div className="flex items-center justify-center h-48 mb-4 bg-yellow-50 rounded-lg relative">
                    <div className="w-32 h-40 bg-gradient-to-b from-yellow-400 to-yellow-600 rounded-lg shadow-md flex items-center justify-center">
                      <div className="text-white text-xs font-bold text-center px-2">
                        빼빼로<br />크런키
                      </div>
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-gray-900 text-center">
                    LOTTE PEPERO
                  </div>
                </div>

                {/* 상품 카드 3: 치토스 & 꼬깔콘 */}
                <div className="bg-white border-2 border-gray-200 rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow">
                  <div className="flex flex-col items-center justify-center h-48 mb-4 bg-gray-50 rounded-lg p-4">
                    <div className="flex gap-2 mb-2">
                      <div className="w-16 h-20 bg-orange-500 rounded-lg"></div>
                      <div className="w-16 h-20 bg-orange-500 rounded-lg"></div>
                    </div>
                    <div className="flex gap-2">
                      <div className="w-12 h-16 bg-yellow-400 rounded-lg"></div>
                      <div className="w-12 h-16 bg-yellow-400 rounded-lg"></div>
                      <div className="w-12 h-16 bg-yellow-400 rounded-lg"></div>
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-gray-900 text-center">
                    Cheetos & 꼬깔콘
                  </div>
                </div>

                {/* 상품 카드 4: Fruit-tella */}
                <div className="bg-white border-2 border-gray-200 rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow relative">
                  <div className="absolute top-4 right-4 bg-yellow-400 rounded-full w-8 h-8 flex items-center justify-center text-xs font-bold text-gray-900 z-10">
                    1개
                  </div>
                  <div className="flex items-center justify-center h-48 mb-4 bg-blue-50 rounded-lg">
                    <div className="w-32 h-40 bg-gradient-to-b from-blue-200 to-blue-400 rounded-lg shadow-md flex items-center justify-center">
                      <div className="text-white text-xs font-bold text-center">
                        Fruit-tella<br />YO!GURT
                      </div>
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-gray-900 text-center">
                    Fruit-tella YOGURT
                  </div>
                </div>
              </div>

              {/* 버튼 */}
              <div
                ref={(el) => { buttonRefs.current[2] = el }}
                className="flex justify-center will-change-transform"
                style={{ opacity: 0, transform: 'translateY(30px)' }}
              >
                <Link
                  href={getRecommendationsHref()}
                  className="group relative inline-flex items-center justify-center px-8 py-4 text-lg font-medium text-white bg-green-600 rounded-lg transition-all duration-300 hover:bg-green-700 hover:scale-105 hover:shadow-xl"
                >
                  <span>추천 상품 확인하기</span>
                  <svg 
                    className="ml-2 w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* 구분선 */}
        <div className="h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent"></div>

        {/* 섹션 3: STEP 3 부진 상품 확인 */}
        <section className="bg-white py-20 md:py-24 lg:py-28">
          <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8">
            <div
              ref={(el) => { sectionRefs.current[3] = el }}
              className="will-change-transform"
              style={{ opacity: 0, transform: 'translateY(50px)' }}
            >
              {/* STEP 3 헤더 */}
              <div className="flex items-center gap-3 mb-6">
                <div className="w-1 h-10 bg-green-200"></div>
                <span className="text-green-600 font-semibold text-base">STEP 3</span>
                <span className="text-gray-900 font-semibold text-base">부진 상품 확인</span>
              </div>

              {/* 메인 제목 */}
              <div className="mb-4">
                <h2 className="text-green-600 text-2xl md:text-3xl font-semibold mb-3">
                  부진 상품
                </h2>
                <h3 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight mb-4">
                  창고를 채우고 있는 부진 상품을 확인하세요.
                </h3>
              </div>

              {/* 설명 텍스트 */}
              <p className="text-lg md:text-xl text-gray-600 mb-12 leading-relaxed max-w-4xl">
                실제 발주 및 판매 데이터 분석을 통해 내 매장의 상품군별 부진 상품 현황을 알려드립니다.
              </p>

              {/* 쓰레기통 아이콘 */}
              <div className="flex justify-center mb-16">
                <div className="w-48 h-48 md:w-64 md:h-64 flex items-center justify-center relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-gray-600 to-gray-800 rounded-lg transform rotate-3 shadow-2xl opacity-20"></div>
                  <div className="relative">
                    <svg 
                      className="w-full h-full text-gray-700 drop-shadow-2xl" 
                      fill="currentColor" 
                      viewBox="0 0 24 24"
                      style={{ filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.3))' }}
                    >
                      <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" 
                        stroke="currentColor" 
                        strokeWidth="2" 
                        strokeLinecap="round" 
                        strokeLinejoin="round"
                        fill="none"
                      />
                    </svg>
                  </div>
                </div>
              </div>

              {/* 버튼 */}
              <div
                ref={(el) => { buttonRefs.current[3] = el }}
                className="flex justify-center will-change-transform"
                style={{ opacity: 0, transform: 'translateY(30px)' }}
              >
                <Link
                  href={getUnderperformingHref()}
                  className="group relative inline-flex items-center justify-center px-8 py-4 text-lg font-medium text-white bg-green-600 rounded-lg transition-all duration-300 hover:bg-green-700 hover:scale-105 hover:shadow-xl"
                >
                  <span>부진 상품 확인하기</span>
                  <svg 
                    className="ml-2 w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            </div>
          </div>
        </section>
          </>
        )}
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fade-in {
          animation: fadeIn 1s ease-out forwards;
        }
      `}</style>
    </Layout>
  )
}

