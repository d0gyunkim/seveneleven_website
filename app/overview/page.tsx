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

  return (
    <Layout>
      <div className="bg-white">
        {/* 첫 화면 - 전체 화면 높이, SEVEN PICK 헤더만 표시 */}
        <div className="bg-white min-h-screen flex items-end justify-start px-4 md:px-6 lg:px-8 pb-12 md:pb-16 lg:pb-20">
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

        {/* 섹션 1: 당신의 매장과 유사한 매장을 AI가 찾아드립니다 */}
        <section className="bg-white py-32 md:py-40 lg:py-48">
          <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8">
            <div
              ref={(el) => { sectionRefs.current[0] = el }}
              className="opacity-0 transition-opacity duration-1000"
            >
              <h2 className="text-5xl md:text-6xl lg:text-7xl font-light text-center text-gray-900 leading-tight mb-8 tracking-tight">
                당신의 매장과 유사한<br />
                <span className="font-semibold text-green-600">매장을 AI가 찾아드립니다</span>
              </h2>
              <p className="text-xl md:text-2xl text-center text-gray-600 max-w-3xl mx-auto leading-relaxed mb-12">
                머신러닝 알고리즘으로 판매 패턴을 분석하여<br />
                가장 유사한 특성을 가진 매장을 선별합니다
              </p>
              
              {/* 버튼 */}
              <div
                ref={(el) => { buttonRefs.current[0] = el }}
                className="opacity-0 flex justify-center mt-12"
              >
                <Link
                  href={getSimilarStoresHref()}
                  className="group relative inline-flex items-center justify-center px-8 py-4 text-lg font-medium text-white bg-green-600 rounded-full transition-all duration-300 hover:bg-green-700 hover:scale-105 hover:shadow-xl"
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

        {/* 섹션 2: 단 우리의 기술은 이렇게 다릅니다 */}
        <section className="bg-white py-32 md:py-40 lg:py-48">
          <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8">
            <div
              ref={(el) => { sectionRefs.current[1] = el }}
              className="opacity-0 transition-opacity duration-1000"
            >
              <h2 className="text-5xl md:text-6xl lg:text-7xl font-light text-center text-gray-900 leading-tight mb-16 tracking-tight">
                단, 우리의 기술은<br />
                <span className="font-semibold text-green-600">이렇게 다릅니다</span>
              </h2>
              
              <div className="grid md:grid-cols-3 gap-12 md:gap-16 mt-20">
                <div className="text-center">
                  <div className="mb-6">
                    <div className="w-16 h-16 md:w-20 md:h-20 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                      <svg className="w-8 h-8 md:w-10 md:h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                  </div>
                  <h3 className="text-2xl md:text-3xl font-semibold text-gray-900 mb-4">실시간 분석</h3>
                  <p className="text-lg text-gray-600 leading-relaxed">
                    최신 데이터를 기반으로<br />
                    지속적으로 업데이트되는<br />
                    유사도 분석
                  </p>
                </div>

                <div className="text-center">
                  <div className="mb-6">
                    <div className="w-16 h-16 md:w-20 md:h-20 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                      <svg className="w-8 h-8 md:w-10 md:h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                  </div>
                  <h3 className="text-2xl md:text-3xl font-semibold text-gray-900 mb-4">다차원 분석</h3>
                  <p className="text-lg text-gray-600 leading-relaxed">
                    판매 패턴, 시간대,<br />
                    주중/주말 비율 등<br />
                    다양한 지표 종합 분석
                  </p>
                </div>

                <div className="text-center">
                  <div className="mb-6">
                    <div className="w-16 h-16 md:w-20 md:h-20 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                      <svg className="w-8 h-8 md:w-10 md:h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                  </div>
                  <h3 className="text-2xl md:text-3xl font-semibold text-gray-900 mb-4">유동인구 반영</h3>
                  <p className="text-lg text-gray-600 leading-relaxed">
                    실시간 유동인구 데이터를<br />
                    결합하여 더욱 정확한<br />
                    상권 특성 파악
                  </p>
                </div>
              </div>

              {/* 버튼 */}
              <div
                ref={(el) => { buttonRefs.current[1] = el }}
                className="opacity-0 flex justify-center mt-16"
              >
                <Link
                  href={getRecommendationsHref()}
                  className="group relative inline-flex items-center justify-center px-8 py-4 text-lg font-medium text-white bg-green-600 rounded-full transition-all duration-300 hover:bg-green-700 hover:scale-105 hover:shadow-xl"
                >
                  <span>추천 상품 알아보기</span>
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

        {/* 섹션 3: 상권은 동적으로 변화합니다 */}
        <section className="bg-white py-32 md:py-40 lg:py-48">
          <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8">
            <div
              ref={(el) => { sectionRefs.current[2] = el }}
              className="opacity-0 transition-opacity duration-1000"
            >
              <h2 className="text-5xl md:text-6xl lg:text-7xl font-light text-center text-gray-900 leading-tight mb-8 tracking-tight">
                <span className="font-semibold text-green-600">상권은 동적으로 변화합니다</span>
              </h2>
              <p className="text-xl md:text-2xl text-center text-gray-600 max-w-3xl mx-auto leading-relaxed mb-16">
                계절, 이벤트, 주변 환경 변화에 따라<br />
                상권 특성이 달라지므로
              </p>

              <div className="mt-20 space-y-8">
                <div className="bg-gradient-to-r from-green-50 to-white p-8 md:p-12 rounded-2xl border border-green-100">
                  <div className="flex items-start gap-6">
                    <div className="flex-shrink-0 w-12 h-12 bg-green-600 rounded-full flex items-center justify-center">
                      <span className="text-white text-xl font-bold">1</span>
                    </div>
                    <div>
                      <h3 className="text-2xl md:text-3xl font-semibold text-gray-900 mb-4">Rolling Window 알고리즘</h3>
                      <p className="text-lg text-gray-600 leading-relaxed">
                        최근 4주 데이터를 유지하며 매주 자동 갱신하여<br />
                        상권의 점진적이고 유동적인 변화를 실시간으로 포착합니다
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-green-50 to-white p-8 md:p-12 rounded-2xl border border-green-100">
                  <div className="flex items-start gap-6">
                    <div className="flex-shrink-0 w-12 h-12 bg-green-600 rounded-full flex items-center justify-center">
                      <span className="text-white text-xl font-bold">2</span>
                    </div>
                    <div>
                      <h3 className="text-2xl md:text-3xl font-semibold text-gray-900 mb-4">시기별 재계산</h3>
                      <p className="text-lg text-gray-600 leading-relaxed">
                        매달 새로운 데이터 기반으로 유사 매장을 재선정하여<br />
                        항상 최신 분석 결과를 제공합니다
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 버튼 */}
              <div
                ref={(el) => { buttonRefs.current[2] = el }}
                className="opacity-0 flex justify-center mt-16"
              >
                <Link
                  href={getSimilarStoresHref()}
                  className="group relative inline-flex items-center justify-center px-8 py-4 text-lg font-medium text-white bg-green-600 rounded-full transition-all duration-300 hover:bg-green-700 hover:scale-105 hover:shadow-xl"
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

