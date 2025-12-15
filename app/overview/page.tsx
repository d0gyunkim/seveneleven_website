'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import Layout from '@/components/Layout'

export default function OverviewPage() {
  const [isVisible, setIsVisible] = useState(false)
  const [heroVisible, setHeroVisible] = useState(false)
  const sectionRefs = useRef<(HTMLDivElement | null)[]>([])
  const buttonRefs = useRef<(HTMLDivElement | null)[]>([])
  const searchParams = useSearchParams()
  const storeCode = searchParams.get('storeCode')

  // 첫 화면 텍스트 애니메이션
  useEffect(() => {
    const timer = setTimeout(() => {
      setHeroVisible(true)
    }, 100)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('animate-fade-in')
            // 버튼도 함께 나타나도록
            const index = sectionRefs.current.findIndex(ref => ref === entry.target)
            if (index >= 0 && buttonRefs.current[index]) {
              setTimeout(() => {
                buttonRefs.current[index]?.classList.add('animate-fade-in')
              }, 300)
            }
          }
        })
      },
      { threshold: 0.1 }
    )

    sectionRefs.current.forEach((ref) => {
      if (ref) observer.observe(ref)
    })

    return () => {
      sectionRefs.current.forEach((ref) => {
        if (ref) observer.unobserve(ref)
      })
    }
  }, [])

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
        <section className="bg-white py-32 md:py-40 lg:py-48">
          <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
            <div
              ref={(el) => { sectionRefs.current[0] = el }}
              className="opacity-0 transition-opacity duration-1000"
            >
              {/* STEP 0 헤더 */}
              <div className="flex items-center gap-4 mb-8">
                <div className="w-1 h-12 bg-green-200"></div>
                <span className="text-green-600 font-semibold text-lg">STEP 0 서비스 핵심 요약</span>
              </div>

              {/* 메인 제목 */}
              <h2 className="text-5xl md:text-6xl lg:text-7xl font-extrabold text-gray-900 leading-tight mb-6 tracking-tight">
                SEVEN PICK: <span className="text-green-600">서비스 핵심</span>
              </h2>
              <p className="text-xl md:text-2xl text-gray-600 mb-16 leading-relaxed">
                발주에 대한 고민을 해결하기 위해 SEVEN PICK: 이 나섭니다.
              </p>

              {/* 메인 콘텐츠 영역 */}
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

              {/* 하단 버튼들 */}
              <div
                ref={(el) => { buttonRefs.current[0] = el }}
                className="opacity-0 flex flex-wrap justify-center gap-4 mt-16"
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
        <section className="bg-gray-900 py-32 md:py-40 lg:py-48">
          <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8">
            <div
              ref={(el) => { sectionRefs.current[1] = el }}
              className="opacity-0 transition-opacity duration-1000"
            >
              {/* STEP 1 헤더 */}
              <div className="flex items-center gap-4 mb-8">
                <span className="text-white font-semibold text-lg">STEP 1</span>
                <span className="text-green-600 font-semibold text-lg">유사 매장 선별</span>
              </div>

              {/* 메인 제목 */}
              <div className="mb-6">
                <h2 className="text-green-600 text-3xl md:text-4xl font-semibold mb-4">
                  유사 매장
                </h2>
                <h3 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white leading-tight mb-6">
                  나와 유사한 매장을 확인하세요.
                </h3>
              </div>

              {/* 설명 텍스트 */}
              <p className="text-xl md:text-2xl text-white mb-16 leading-relaxed max-w-4xl">
                계속 변화하는 상권과 판매흐름을 포착하여 더 정확한, 더 완벽한 유사매장을 선별합니다.
              </p>

              {/* 선택 기준 버튼들 */}
              <div className="flex flex-wrap gap-4 mb-12">
                <button className="px-6 py-3 bg-white text-gray-900 rounded-lg font-medium hover:bg-gray-100 transition-colors">
                  매장 판매 추세
                </button>
                <button className="px-6 py-3 bg-white text-gray-900 rounded-lg font-medium hover:bg-gray-100 transition-colors">
                  유동 인구 3분위
                </button>
                <button className="px-6 py-3 bg-white text-gray-900 rounded-lg font-medium hover:bg-gray-100 transition-colors">
                  Rolling Window
                </button>
              </div>

              {/* 시각적 요소: 초록색 삼각형과 아이콘 */}
              <div className="flex flex-col items-center mb-12">
                {/* 초록색 삼각형 (깔때기 모양) */}
                <div className="relative w-full max-w-2xl mb-8 flex justify-center">
                  <svg 
                    width="400" 
                    height="200" 
                    viewBox="0 0 400 200" 
                    className="w-full max-w-md"
                    preserveAspectRatio="xMidYMid meet"
                  >
                    <polygon 
                      points="0,0 400,0 350,200 50,200" 
                      fill="#16a34a" 
                      className="drop-shadow-lg"
                    />
                  </svg>
                </div>
                
                {/* 중앙 아이콘 */}
                <div className="relative -mt-16 md:-mt-20">
                  <div className="w-24 h-24 md:w-32 md:h-32 bg-white rounded-full flex items-center justify-center shadow-xl">
                    <div className="w-16 h-16 md:w-20 md:h-20 bg-green-600 rounded-lg flex items-center justify-center transform rotate-45">
                      <svg 
                        className="w-10 h-10 md:w-12 md:h-12 text-white transform -rotate-45" 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              {/* 버튼 */}
              <div
                ref={(el) => { buttonRefs.current[1] = el }}
                className="opacity-0 flex justify-center"
              >
                <Link
                  href={getSimilarStoresHref()}
                  className="group relative inline-flex items-center justify-center px-8 py-4 text-lg font-medium text-white bg-green-600 rounded-lg transition-all duration-300 hover:bg-green-700 hover:scale-105 hover:shadow-xl"
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
        <section className="bg-white py-32 md:py-40 lg:py-48">
          <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8">
            <div
              ref={(el) => { sectionRefs.current[2] = el }}
              className="opacity-0 transition-opacity duration-1000"
            >
              {/* STEP 2 헤더 */}
              <div className="flex items-center gap-4 mb-8">
                <span className="text-green-600 font-semibold text-lg">STEP 2</span>
                <span className="text-gray-900 font-semibold text-lg">발주 추천 상품 확인</span>
              </div>

              {/* 메인 제목 */}
              <div className="mb-6">
                <h2 className="text-green-600 text-3xl md:text-4xl font-semibold mb-4">
                  추천 상품
                </h2>
                <h3 className="text-5xl md:text-6xl lg:text-7xl font-bold text-gray-900 leading-tight mb-4">
                  추천 상품을 확인하세요.
                </h3>
                <h4 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight mb-6">
                  보다 편하고, 보다 자세하게.
                </h4>
              </div>

              {/* 설명 텍스트 */}
              <p className="text-xl md:text-2xl text-gray-600 mb-16 leading-relaxed max-w-4xl">
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
                className="opacity-0 flex justify-center"
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
        <section className="bg-white py-32 md:py-40 lg:py-48">
          <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8">
            <div
              ref={(el) => { sectionRefs.current[3] = el }}
              className="opacity-0 transition-opacity duration-1000"
            >
              {/* STEP 3 헤더 */}
              <div className="flex items-center gap-4 mb-8">
                <div className="w-1 h-12 bg-green-200"></div>
                <span className="text-green-600 font-semibold text-lg">STEP 3</span>
                <span className="text-gray-900 font-semibold text-lg">부진 상품 확인</span>
              </div>

              {/* 메인 제목 */}
              <div className="mb-6">
                <h2 className="text-green-600 text-3xl md:text-4xl font-semibold mb-4">
                  부진 상품
                </h2>
                <h3 className="text-5xl md:text-6xl lg:text-7xl font-bold text-gray-900 leading-tight mb-6">
                  창고를 채우고 있는 부진 상품을 확인하세요.
                </h3>
              </div>

              {/* 설명 텍스트 */}
              <p className="text-xl md:text-2xl text-gray-600 mb-16 leading-relaxed max-w-4xl">
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
                className="opacity-0 flex justify-center"
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

