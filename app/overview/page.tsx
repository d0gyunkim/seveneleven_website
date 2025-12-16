'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import Layout from '@/components/Layout'
import { supabase } from '@/lib/supabase'

interface Product {
  store_code: string
  item_cd: string
  store_nm: string
  item_nm: string
  item_img: string | null
  pred_score: number | null
  rank: number | null
  item_mddv_cd: number | null
  item_mddv_nm: string | null
  item_lrdv_nm: string | null
  item_smdv_nm: string | null
  cost: number | null
  sale_price: number | null
  rec_reason: string | null
}

export default function OverviewPage() {
  const [isVisible, setIsVisible] = useState(false)
  const [heroVisible, setHeroVisible] = useState(false)
  const [isApp, setIsApp] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [topRecommendedProducts, setTopRecommendedProducts] = useState<Product[]>([])
  const [topUnderperformingProducts, setTopUnderperformingProducts] = useState<Product[]>([])
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [showCriteriaModal, setShowCriteriaModal] = useState(false) // 유사 매장 선정 기준 모달
  const [showRollingWindowModal, setShowRollingWindowModal] = useState(false) // Rolling Window 알고리즘 모달
  const [showDynamicAreaModal, setShowDynamicAreaModal] = useState(false) // 동적 상권 포착 모달
  const [previewPage, setPreviewPage] = useState<'recommended' | 'excluded' | 'similar'>('recommended') // 모바일 프리뷰 페이지
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

  // 추천 상품 및 부진 상품 데이터 가져오기
  useEffect(() => {
    const fetchTopProducts = async () => {
      if (!storeCode) return

      setLoadingProducts(true)
      try {
        const knownStores = ['대치본점', '대치은마사거리점']
        let foundStoreName: string | null = null
        let recommendedTable: string | null = null
        let excludedTable: string | null = null

        // 매장 테이블 찾기
        for (const storeName of knownStores) {
          const recTable = `${storeName}_추천상품`
          const excTable = `${storeName}_부진재고`

          const codeVariants = [storeCode, storeCode.toString(), parseInt(storeCode).toString()]
          
          for (const codeVariant of codeVariants) {
            const { data: recData, error: recError } = await supabase
              .from(recTable)
              .select('store_nm, store_code')
              .eq('store_code', codeVariant)
              .limit(1)

            if (!recError && recData && recData.length > 0) {
              foundStoreName = recData[0].store_nm || storeName
              recommendedTable = recTable
              excludedTable = excTable
              break
            }
          }
          
          if (foundStoreName) break
        }

        if (!foundStoreName || !recommendedTable) {
          console.log('매장 데이터를 찾을 수 없습니다.')
          setLoadingProducts(false)
          return
        }

        // 추천 상품 상위 3개 가져오기
        const { data: recommendedData, error: recommendedError } = await supabase
          .from(recommendedTable)
          .select('*')
          .eq('store_code', storeCode)
          .order('rank', { ascending: true, nullsFirst: false })
          .limit(3)

        if (recommendedError) {
          console.error('추천 상품 조회 오류:', recommendedError)
        } else if (recommendedData) {
          // 상품마스터에서 이미지 가져오기
          const itemCds = recommendedData.map((p: any) => p.item_cd?.toString()).filter(Boolean)
          const itemImgMap = new Map<string, string>()
          
          if (itemCds.length > 0) {
            const { data: masterData } = await supabase
              .from('상품마스터')
              .select('ITEM_CD, item_img')
              .in('ITEM_CD', itemCds)

            if (masterData) {
              masterData.forEach((item: any) => {
                if (item.ITEM_CD && item.item_img) {
                  itemImgMap.set(item.ITEM_CD.toString(), item.item_img)
                }
              })
            }
          }

          // 이미지 적용
          const updatedRecommended = recommendedData.map((product: any) => {
            const itemCd = product.item_cd?.toString()
            if (itemCd && itemImgMap.has(itemCd) && !product.item_img) {
              return { ...product, item_img: itemImgMap.get(itemCd) }
            }
            return product
          })
          setTopRecommendedProducts(updatedRecommended)
        }

        // 부진 상품 상위 3개 가져오기
        if (excludedTable) {
          const codeVariants = [storeCode, storeCode.toString(), parseInt(storeCode).toString()]
          let excludedData: any[] | null = null
          let excludedError: any = null

          // 여러 codeVariants로 시도
          for (const codeVariant of codeVariants) {
            // 먼저 rank로 정렬 시도
            const { data: dataWithRank, error: errorWithRank } = await supabase
              .from(excludedTable)
              .select('*')
              .eq('store_code', codeVariant)
              .order('rank', { ascending: true, nullsFirst: false })
              .limit(3)

            if (!errorWithRank && dataWithRank && dataWithRank.length > 0) {
              excludedData = dataWithRank
              break
            }

            // rank 필드가 없거나 오류가 있으면 rank 없이 조회
            if (errorWithRank || !dataWithRank || dataWithRank.length === 0) {
              const { data: dataWithoutRank, error: errorWithoutRank } = await supabase
                .from(excludedTable)
                .select('*')
                .eq('store_code', codeVariant)
                .limit(3)

              if (!errorWithoutRank && dataWithoutRank && dataWithoutRank.length > 0) {
                excludedData = dataWithoutRank
                break
              } else if (errorWithoutRank && !excludedError) {
                excludedError = errorWithoutRank
              }
            }
          }

          if (excludedError && !excludedData) {
            console.error('부진 상품 조회 오류:', excludedError)
          } else if (excludedData) {
            // 상품마스터에서 이미지 가져오기
            const itemCds = excludedData.map((p: any) => p.item_cd?.toString()).filter(Boolean)
            const itemImgMap = new Map<string, string>()
            
            if (itemCds.length > 0) {
              const { data: masterData } = await supabase
                .from('상품마스터')
                .select('ITEM_CD, item_img')
                .in('ITEM_CD', itemCds)

              if (masterData) {
                masterData.forEach((item: any) => {
                  if (item.ITEM_CD && item.item_img) {
                    itemImgMap.set(item.ITEM_CD.toString(), item.item_img)
                  }
                })
              }
            }

            // 이미지 적용
            const updatedExcluded = excludedData.map((product: any) => {
              const itemCd = product.item_cd?.toString()
              if (itemCd && itemImgMap.has(itemCd) && !product.item_img) {
                return { ...product, item_img: itemImgMap.get(itemCd) }
              }
              return product
            })
            setTopUnderperformingProducts(updatedExcluded)
          }
        }
      } catch (err) {
        console.error('상품 데이터 조회 중 오류:', err)
      } finally {
        setLoadingProducts(false)
      }
    }

    fetchTopProducts()
  }, [storeCode])

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
      return `/recommendations?storeCode=${encodeURIComponent(storeCode)}&tab=excluded`
    }
    return '/recommendations?tab=excluded'
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
                    {previewPage === 'recommended' && (
                      <>
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
                      </>
                    )}
                    {previewPage === 'excluded' && (
                      <>
                        <h3 className="text-xl font-bold text-gray-900 mb-3">
                          부진 상품 안내
                        </h3>
                        <p className="text-sm">
                          내 매장의 판매, 재고, 발주 데이터를 학습하여 현재 제외할 상품을 추천합니다.
                        </p>
                        <p className="text-sm">
                          확인하고 싶은 대분류 카테고리를 선택하여 내가 원하는 상품군의 부진 상품만 확인할 수 있습니다.
                        </p>
                        <p className="text-sm">
                          부진 상품 클릭 시 해당 상품의 세부 정보 및 부진 근거를 확인할 수 있습니다.
                        </p>
                      </>
                    )}
                    {previewPage === 'similar' && (
                      <>
                        <h3 className="text-xl font-bold text-gray-900 mb-3">
                          유사 매장 리포팅
                        </h3>
                        <p className="text-sm">
                          내 매장과 가장 비슷한 월별 Top5 유사 매장과 유사 매장 평균 데이터를 기반으로 판매 및 운영의 종합적 분석을 제공합니다.
                        </p>
                        <p className="text-sm">
                          유사 매장의 인기 상품 순위를 확인할 수 있으며, LLM 기반의 점주 친화적 설명을 안내합니다.
                        </p>
                      </>
                    )}
                  </div>

                  {/* 하단 버튼들 */}
                  <div
                    ref={(el) => { buttonRefs.current[0] = el }}
                    className="flex flex-wrap justify-center gap-3 mt-8 will-change-transform"
                    style={{ opacity: 0, transform: 'translateY(30px)' }}
                  >
                    <button
                      onClick={() => setPreviewPage('similar')}
                      className={`px-6 py-3 text-sm font-medium rounded-lg transition-all duration-300 ${
                        previewPage === 'similar'
                          ? 'bg-gray-300 text-gray-900'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      유사 매장 페이지
                    </button>
                    <button
                      onClick={() => setPreviewPage('recommended')}
                      className={`px-6 py-3 text-sm font-medium rounded-lg transition-all duration-300 ${
                        previewPage === 'recommended'
                          ? 'bg-gray-300 text-gray-900'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      추천 상품 페이지
                    </button>
                    <button
                      onClick={() => setPreviewPage('excluded')}
                      className={`px-6 py-3 text-sm font-medium rounded-lg transition-all duration-300 ${
                        previewPage === 'excluded'
                          ? 'bg-gray-300 text-gray-900'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      부진 상품 페이지
                    </button>
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
                          <h4 className="text-sm font-semibold text-gray-900 mb-1">동적 상권 포착</h4>
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
                  {loadingProducts ? (
                    <div className="grid grid-cols-2 gap-4 mb-8">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="bg-gray-100 border-2 border-gray-200 rounded-xl p-4 shadow-lg animate-pulse">
                          <div className="h-32 bg-gray-200 rounded-lg mb-3"></div>
                          <div className="h-4 bg-gray-200 rounded"></div>
                        </div>
                      ))}
                    </div>
                  ) : topRecommendedProducts.length > 0 ? (
                    <div className="grid grid-cols-2 gap-4 mb-8">
                      {topRecommendedProducts.slice(0, 3).map((product, index) => (
                        <div key={product.item_cd || index} className="bg-white border-2 border-gray-200 rounded-xl p-4 shadow-lg hover:shadow-xl transition-shadow">
                          <div className="flex items-center justify-center h-32 mb-3 bg-gray-50 rounded-lg overflow-hidden">
                            {product.item_img ? (
                              <img 
                                src={product.item_img} 
                                alt={product.item_nm || '상품 이미지'} 
                                className="w-full h-full object-contain"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none'
                                  const parent = (e.target as HTMLImageElement).parentElement
                                  if (parent) {
                                    parent.innerHTML = '<div class="text-xs text-gray-400">이미지 없음</div>'
                                  }
                                }}
                              />
                            ) : (
                              <div className="text-xs text-gray-400">이미지 없음</div>
                            )}
                          </div>
                          <div className="text-xs font-semibold text-gray-900 text-center line-clamp-2">
                            {product.item_nm || '상품명 없음'}
                          </div>
                          {product.sale_price && (
                            <div className="text-xs text-gray-600 text-center mt-1">
                              {product.sale_price.toLocaleString()}원
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4 mb-8">
                      <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-4 text-center text-sm text-gray-500">
                        추천 상품 데이터가 없습니다
                      </div>
                    </div>
                  )}

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

                  {/* 부진 상품 카드 그리드 */}
                  {loadingProducts ? (
                    <div className="grid grid-cols-2 gap-4 mb-8">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="bg-gray-100 border-2 border-gray-200 rounded-xl p-4 shadow-lg animate-pulse">
                          <div className="h-32 bg-gray-200 rounded-lg mb-3"></div>
                          <div className="h-4 bg-gray-200 rounded"></div>
                        </div>
                      ))}
                    </div>
                  ) : topUnderperformingProducts.length > 0 ? (
                    <div className="grid grid-cols-2 gap-4 mb-8">
                      {topUnderperformingProducts.slice(0, 3).map((product, index) => (
                        <div key={product.item_cd || index} className="bg-white border-2 border-red-200 rounded-xl p-4 shadow-lg hover:shadow-xl transition-shadow">
                          <div className="flex items-center justify-center h-32 mb-3 bg-gray-50 rounded-lg overflow-hidden">
                            {product.item_img ? (
                              <img 
                                src={product.item_img} 
                                alt={product.item_nm || '상품 이미지'} 
                                className="w-full h-full object-contain opacity-75"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none'
                                  const parent = (e.target as HTMLImageElement).parentElement
                                  if (parent) {
                                    parent.innerHTML = '<div class="text-xs text-gray-400">이미지 없음</div>'
                                  }
                                }}
                              />
                            ) : (
                              <div className="text-xs text-gray-400">이미지 없음</div>
                            )}
                          </div>
                          <div className="text-xs font-semibold text-gray-900 text-center line-clamp-2">
                            {product.item_nm || '상품명 없음'}
                          </div>
                          {product.sale_price && (
                            <div className="text-xs text-gray-600 text-center mt-1">
                              {product.sale_price.toLocaleString()}원
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4 mb-8">
                      <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-4 text-center text-sm text-gray-500">
                        부진 상품 데이터가 없습니다
                      </div>
                    </div>
                  )}

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
                            <div 
                              className="px-4 py-3 text-sm text-gray-600 cursor-pointer"
                              onClick={() => setPreviewPage('recommended')}
                            >
                              서비스 개요
                            </div>
                            <div 
                              className={`px-4 py-3 text-sm cursor-pointer ${
                                previewPage === 'recommended' 
                                  ? 'font-semibold bg-green-600 text-white' 
                                  : 'text-gray-600'
                              }`}
                              onClick={() => setPreviewPage('recommended')}
                            >
                              추천 상품
                            </div>
                            <div 
                              className={`px-4 py-3 text-sm cursor-pointer ${
                                previewPage === 'excluded' 
                                  ? 'font-semibold bg-green-600 text-white' 
                                  : 'text-gray-600'
                              }`}
                              onClick={() => setPreviewPage('excluded')}
                            >
                              부진 상품
                            </div>
                            <div 
                              className={`px-4 py-3 text-sm cursor-pointer ${
                                previewPage === 'similar' 
                                  ? 'font-semibold bg-green-600 text-white' 
                                  : 'text-gray-600'
                              }`}
                              onClick={() => setPreviewPage('similar')}
                            >
                              유사 매장 리포팅
                            </div>
                          </div>
                        </div>

                        {/* 메인 콘텐츠 */}
                        {previewPage === 'recommended' && (
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
                              <button className="text-xs text-gray-600 mb-2 hover:text-gray-900">초기화</button>
                              <div className="space-y-1 text-xs">
                                <div className="flex items-center gap-2">
                                  <input type="radio" className="w-3 h-3" defaultChecked />
                                  <span>전체(35)</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <input type="radio" className="w-3 h-3" />
                                  <span>껌(5)</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <input type="radio" className="w-3 h-3" />
                                  <span>비스킷류(5)</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <input type="radio" className="w-3 h-3" />
                                  <span>스낵류(5)</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <input type="radio" className="w-3 h-3" />
                                  <span>젤리류(5)</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <input type="radio" className="w-3 h-3" />
                                  <span>초콜릿(5)</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <input type="radio" className="w-3 h-3" />
                                  <span>캔디류(5)</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <input type="radio" className="w-3 h-3" />
                                  <span>프로틴/시리얼(5)</span>
                                </div>
                              </div>
                            </div>

                            {/* 상품 목록 */}
                            <div className="flex-1 overflow-y-auto max-h-[500px]">
                              {/* 껌 섹션 */}
                              <div className="mb-6">
                                <h4 className="text-sm font-semibold mb-3">껌</h4>
                                <div className="grid grid-cols-2 gap-3">
                                  {[
                                    { name: '롯데)자일리톨알파오리지날용기 86g', price: '6,000' },
                                    { name: '투데이)미니베어풍선껌(델리스)', price: '1,000' },
                                    { name: '롯데)자일리톨오리지날리필115g', price: '6,000' },
                                    { name: '롯데)왓따판박이(티니핑)13.7g', price: '600' },
                                    { name: '롯데)이브로즈껌26g', price: '1,200' }
                                  ].map((product, idx) => (
                                    <div key={idx} className="bg-gray-50 rounded-lg p-2">
                                      <div className="bg-gray-200 rounded h-24 mb-2 flex items-center justify-center text-xs text-gray-400">
                                        이미지 없음
                                      </div>
                                      <div className="text-xs font-medium mb-1 line-clamp-2">
                                        {product.name}
                                      </div>
                                      <div className="text-xs text-gray-600">{product.price}원</div>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* 비스킷류 섹션 */}
                              <div>
                                <h4 className="text-sm font-semibold mb-3">비스킷류</h4>
                                <div className="grid grid-cols-2 gap-3">
                                  {[
                                    { name: '롯데)크런키빼빼로39g', price: '2,000' },
                                    { name: '오리온)비쵸비5P', price: '3,600' },
                                    { name: '크라운)쿠크다스(커피)128g', price: '3,000' },
                                    { name: '크라운)화이트하임49g', price: '1,400' },
                                    { name: '크라운)뽀또치즈타르트92g', price: '1,500' }
                                  ].map((product, idx) => (
                                    <div key={idx} className="bg-gray-50 rounded-lg p-2">
                                      <div className="bg-gray-200 rounded h-24 mb-2 flex items-center justify-center text-xs text-gray-400">
                                        이미지 없음
                                      </div>
                                      <div className="text-xs font-medium mb-1 line-clamp-2">
                                        {product.name}
                                      </div>
                                      <div className="text-xs text-gray-600">{product.price}원</div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        )}

                        {/* 부진 상품 페이지 */}
                        {previewPage === 'excluded' && (
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
                              <button className="text-xs text-gray-600 mb-2 hover:text-gray-900">초기화</button>
                              <div className="space-y-1 text-xs">
                                <div className="flex items-center gap-2">
                                  <input type="radio" className="w-3 h-3" defaultChecked />
                                  <span>전체(20)</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <input type="radio" className="w-3 h-3" />
                                  <span>과자류(5)</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <input type="radio" className="w-3 h-3" />
                                  <span>음료류(5)</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <input type="radio" className="w-3 h-3" />
                                  <span>냉장류(5)</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <input type="radio" className="w-3 h-3" />
                                  <span>기타(5)</span>
                                </div>
                              </div>
                            </div>

                            {/* 상품 목록 */}
                            <div className="flex-1 overflow-y-auto max-h-[500px]">
                              <div className="grid grid-cols-2 gap-3">
                                {[1, 2, 3, 4, 5].map((i) => (
                                  <div key={i} className="bg-gray-50 rounded-lg p-2 border border-red-200">
                                    <div className="bg-gray-200 rounded h-24 mb-2 flex items-center justify-center text-xs text-gray-400">
                                      이미지 없음
                                    </div>
                                    <div className="text-xs font-medium mb-1 line-clamp-2 text-gray-700">
                                      부진 상품 {i}
                                    </div>
                                    <div className="text-xs text-gray-600">5,000원</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                        )}

                        {/* 유사 매장 페이지 */}
                        {previewPage === 'similar' && (
                        <div className="p-4">
                          <div className="mb-4">
                            <h3 className="text-base font-bold text-gray-900 mb-2">우리 매장과 유사 매장 찾기</h3>
                            <p className="text-xs text-gray-600 mb-3">한달 동안, 우리 매장과 가장 유사한 매장들을 알려드립니다</p>
                            
                            {/* 분석 기간 */}
                            <div className="flex items-center gap-2 mb-4">
                              <span className="text-xs font-semibold text-gray-700">분석 기간</span>
                              <button className="px-3 py-1 text-xs bg-green-600 text-white rounded">9월</button>
                              <button className="px-3 py-1 text-xs bg-white text-gray-700 border border-gray-300 rounded">8월</button>
                            </div>
                          </div>

                          <div className="flex gap-4">
                            {/* 왼쪽: 유사 매장 순위 */}
                            <div className="w-40 flex-shrink-0">
                              <h4 className="text-sm font-bold text-gray-900 mb-2">유사 매장 순위</h4>
                              <p className="text-xs text-gray-500 mb-3">클릭하여 상세 분석 리포트 확인</p>
                              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                                {[
                                  { rank: 1, name: '대치은마사거리점', address: '서울시 서대문구 회기로 24길' },
                                  { rank: 2, name: '잠실새내역점', address: '서울시 남대문구 회기로 24길' },
                                  { rank: 3, name: '삼성역트레이드센터점', address: '서울시 동대문구 이문로 24길' },
                                  { rank: 4, name: '역삼타운점', address: '서울시 한남대로 24길' }
                                ].map((store) => (
                                  <div key={store.rank} className="bg-gray-50 rounded p-2 border border-gray-200 cursor-pointer hover:bg-gray-100">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="w-6 h-6 bg-green-600 text-white text-xs font-bold rounded flex items-center justify-center">
                                        {store.rank}
                                      </span>
                                      <span className="text-xs font-semibold text-gray-900">세븐일레븐 {store.name}</span>
                                    </div>
                                    <p className="text-xs text-gray-600 ml-8">{store.address}</p>
                                    <p className="text-xs text-gray-500 ml-8">영업시간: 24시간 · 매장면적 23m²</p>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* 오른쪽: 지도 */}
                            <div className="flex-1">
                              <h4 className="text-sm font-bold text-gray-900 mb-2">유사 매장 위치</h4>
                              <p className="text-xs text-gray-500 mb-3">기준 월: 9월</p>
                              <div className="bg-gray-200 rounded-lg h-[400px] flex items-center justify-center">
                                <span className="text-xs text-gray-400">지도 영역</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 오른쪽: 설명 텍스트 */}
                  <div className="space-y-6">
                    {previewPage === 'recommended' && (
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
                    )}
                    {previewPage === 'excluded' && (
                      <div>
                        <h3 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
                          부진 상품 안내
                        </h3>
                        <div className="space-y-4 text-gray-700 leading-relaxed">
                          <p className="text-lg">
                            내 매장의 판매, 재고, 발주 데이터를 학습하여 현재 제외할 상품을 추천합니다.
                          </p>
                          <p className="text-lg">
                            확인하고 싶은 대분류 카테고리를 선택하여 내가 원하는 상품군의 부진 상품만 확인할 수 있습니다.
                          </p>
                          <p className="text-lg">
                            부진 상품 클릭 시 해당 상품의 세부 정보 및 부진 근거를 확인할 수 있습니다.
                          </p>
                        </div>
                      </div>
                    )}
                    {previewPage === 'similar' && (
                      <div>
                        <h3 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
                          유사 매장 리포팅
                        </h3>
                        <div className="space-y-4 text-gray-700 leading-relaxed">
                          <p className="text-lg">
                            내 매장과 가장 비슷한 월별 Top5 유사 매장과 유사 매장 평균 데이터를 기반으로 판매 및 운영의 종합적 분석을 제공합니다.
                          </p>
                          <p className="text-lg">
                            유사 매장의 인기 상품 순위를 확인할 수 있으며, LLM 기반의 점주 친화적 설명을 안내합니다.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 하단 버튼들 */}
              <div
                ref={(el) => { buttonRefs.current[0] = el }}
                className="flex flex-wrap justify-center gap-4 mt-16 will-change-transform"
                style={{ opacity: 0, transform: 'translateY(30px)' }}
              >
                <button
                  onClick={() => setPreviewPage('similar')}
                  className={`px-8 py-4 text-lg font-medium rounded-lg transition-all duration-300 hover:scale-105 ${
                    previewPage === 'similar'
                      ? 'bg-gray-300 text-gray-900'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  유사 매장 페이지
                </button>
                <button
                  onClick={() => setPreviewPage('recommended')}
                  className={`px-8 py-4 text-lg font-medium rounded-lg transition-all duration-300 hover:scale-105 ${
                    previewPage === 'recommended'
                      ? 'bg-gray-300 text-gray-900'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  추천 상품 페이지
                </button>
                <button
                  onClick={() => setPreviewPage('excluded')}
                  className={`px-8 py-4 text-lg font-medium rounded-lg transition-all duration-300 hover:scale-105 ${
                    previewPage === 'excluded'
                      ? 'bg-gray-300 text-gray-900'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  부진 상품 페이지
                </button>
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
                <div 
                  className="bg-white rounded-xl p-6 border border-green-200 shadow-sm hover:shadow-lg transition-all duration-300 hover:border-green-300 cursor-pointer"
                  onClick={() => setShowCriteriaModal(true)}
                >
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

                <div 
                  className="bg-white rounded-xl p-6 border border-green-200 shadow-sm hover:shadow-lg transition-all duration-300 hover:border-green-300 cursor-pointer"
                  onClick={() => setShowDynamicAreaModal(true)}
                >
                  <div className="flex flex-col items-start">
                    <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mb-4">
                      <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-2">동적 상권 포착</h4>
                    <p className="text-sm text-gray-500 leading-relaxed">상권의 유동인구 데이터를 반영하여 더욱 정확한 상권 특성을 파악합니다.</p>
                  </div>
                </div>

                <div 
                  className="bg-white rounded-xl p-6 border border-green-200 shadow-sm hover:shadow-lg transition-all duration-300 hover:border-green-300 cursor-pointer"
                  onClick={() => setShowRollingWindowModal(true)}
                >
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
              {loadingProducts ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-6 md:gap-8 mb-16 max-w-4xl mx-auto">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="bg-gray-100 border-2 border-gray-200 rounded-xl p-6 shadow-lg animate-pulse">
                      <div className="h-48 bg-gray-200 rounded-lg mb-4"></div>
                      <div className="h-4 bg-gray-200 rounded"></div>
                    </div>
                  ))}
                </div>
              ) : topRecommendedProducts.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-6 md:gap-8 mb-16 max-w-4xl mx-auto">
                  {topRecommendedProducts.slice(0, 3).map((product, index) => (
                    <div key={product.item_cd || index} className="bg-white border-2 border-gray-200 rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow">
                      <div className="flex items-center justify-center h-48 mb-4 bg-gray-50 rounded-lg overflow-hidden">
                        {product.item_img ? (
                          <img 
                            src={product.item_img} 
                            alt={product.item_nm || '상품 이미지'} 
                            className="w-full h-full object-contain"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none'
                              const parent = (e.target as HTMLImageElement).parentElement
                              if (parent) {
                                parent.innerHTML = '<div class="text-sm text-gray-400">이미지 없음</div>'
                              }
                            }}
                          />
                        ) : (
                          <div className="text-sm text-gray-400">이미지 없음</div>
                        )}
                      </div>
                      <div className="text-sm font-semibold text-gray-900 text-center line-clamp-2">
                        {product.item_nm || '상품명 없음'}
                      </div>
                      {product.sale_price && (
                        <div className="text-sm text-gray-600 text-center mt-2">
                          {product.sale_price.toLocaleString()}원
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-6 md:gap-8 mb-16 max-w-4xl mx-auto">
                  <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-6 text-center text-base text-gray-500">
                    추천 상품 데이터가 없습니다
                  </div>
                </div>
              )}

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

              {/* 부진 상품 카드 그리드 */}
              {loadingProducts ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-6 md:gap-8 mb-16 max-w-4xl mx-auto">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="bg-gray-100 border-2 border-gray-200 rounded-xl p-6 shadow-lg animate-pulse">
                      <div className="h-48 bg-gray-200 rounded-lg mb-4"></div>
                      <div className="h-4 bg-gray-200 rounded"></div>
                    </div>
                  ))}
                </div>
              ) : topUnderperformingProducts.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-6 md:gap-8 mb-16 max-w-4xl mx-auto">
                  {topUnderperformingProducts.slice(0, 3).map((product, index) => (
                    <div key={product.item_cd || index} className="bg-white border-2 border-red-200 rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow">
                      <div className="flex items-center justify-center h-48 mb-4 bg-gray-50 rounded-lg overflow-hidden">
                        {product.item_img ? (
                          <img 
                            src={product.item_img} 
                            alt={product.item_nm || '상품 이미지'} 
                            className="w-full h-full object-contain opacity-75"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none'
                              const parent = (e.target as HTMLImageElement).parentElement
                              if (parent) {
                                parent.innerHTML = '<div class="text-sm text-gray-400">이미지 없음</div>'
                              }
                            }}
                          />
                        ) : (
                          <div className="text-sm text-gray-400">이미지 없음</div>
                        )}
                      </div>
                      <div className="text-sm font-semibold text-gray-900 text-center line-clamp-2">
                        {product.item_nm || '상품명 없음'}
                      </div>
                      {product.sale_price && (
                        <div className="text-sm text-gray-600 text-center mt-2">
                          {product.sale_price.toLocaleString()}원
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-6 md:gap-8 mb-16 max-w-4xl mx-auto">
                  <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-6 text-center text-base text-gray-500">
                    부진 상품 데이터가 없습니다
                  </div>
                </div>
              )}

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

      {/* 유사 매장 선정 기준 모달 */}
      {showCriteriaModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={() => setShowCriteriaModal(false)}>
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b-2 border-gray-300 px-6 py-4 flex items-center justify-between z-10">
              <div className="flex items-baseline gap-4">
                <div className="w-1 h-8 bg-green-600"></div>
                <h3 className="text-xl font-bold text-gray-900 uppercase tracking-wide">유사 매장 선정 기준</h3>
                <span className="ml-auto px-3 py-1 bg-green-600 text-white text-xs font-bold">4가지 핵심 지표</span>
              </div>
              <button
                onClick={() => setShowCriteriaModal(false)}
                className="ml-4 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-6 md:p-8">
              <div className="mb-6 pb-4 border-b-2 border-gray-300">
                <p className="text-sm text-gray-700 leading-relaxed">
                  머신러닝 알고리즘을 통해 <span className="font-semibold">판매 패턴 분석</span>과 
                  <span className="font-semibold">유동인구 데이터</span>를 종합 분석하여 
                  최적의 유사 매장을 선정합니다.
                </p>
              </div>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-gray-50 border border-gray-300 p-5">
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-300">
                    <div className="w-2 h-2 bg-green-600"></div>
                    <h5 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
                      판매 상품 패턴
                    </h5>
                  </div>
                  <p className="text-sm text-gray-700 mb-3 leading-relaxed">
                    대분류 카테고리별 판매량 비중 분석을 통한 소비자 구매 패턴 파악
                  </p>
                </div>
                
                <div className="bg-gray-50 border border-gray-300 p-5">
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-300">
                    <div className="w-2 h-2 bg-green-600"></div>
                    <h5 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
                      시간대별 패턴
                    </h5>
                  </div>
                  <p className="text-sm text-gray-700 mb-3 leading-relaxed">
                    주중/주말 × 시간대별 매출 비중 분석을 통한 고객 유입 패턴 추적
                  </p>
                </div>
                
                <div className="bg-gray-50 border border-gray-300 p-5">
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-300">
                    <div className="w-2 h-2 bg-green-600"></div>
                    <h5 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
                      주중/주말 편중도
                    </h5>
                  </div>
                  <p className="text-sm text-gray-700 mb-3 leading-relaxed">
                    주중 대비 주말 매출 비율 계산을 통한 상권 성격(오피스/주거/관광) 분석
                  </p>
                </div>
                
                <div className="bg-gray-50 border-2 border-green-600 p-5">
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-300">
                    <div className="w-2 h-2 bg-green-600"></div>
                    <h5 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
                      유동인구 데이터
                    </h5>
                    <span className="ml-auto px-2 py-0.5 bg-green-600 text-white text-[10px] font-bold">핵심</span>
                  </div>
                  <p className="text-sm text-gray-700 mb-3 leading-relaxed">
                    실시간 유동인구 정보와 방문객 패턴 분석을 통한 상권 특성 정확한 반영
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rolling Window 알고리즘 모달 */}
      {showRollingWindowModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={() => setShowRollingWindowModal(false)}>
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b-2 border-gray-300 px-6 py-4 flex items-center justify-between z-10">
              <div className="flex items-baseline gap-4 flex-1">
                <h3 className="text-2xl font-bold text-gray-900">ROLLING WINDOW 알고리즘</h3>
                <span className="ml-auto px-3 py-1 bg-green-600 text-white text-xs font-bold">자동 갱신</span>
              </div>
              <button
                onClick={() => setShowRollingWindowModal(false)}
                className="ml-4 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-6 md:p-8">
              {/* 설명 */}
              <div className="mb-6 pb-4 border-b-2 border-gray-300">
                <p className="text-sm text-gray-700 leading-relaxed">
                  상권 변화를 실시간으로 반영하기 위해 최근 4주 데이터를 유지하며 2주마다 자동 갱신하는 Rolling Window 알고리즘을 적용합니다.
                </p>
              </div>

              {/* 분석 구간 & 갱신 주기 */}
              <div className="grid md:grid-cols-2 gap-6 mb-8">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-1 h-6 bg-green-600"></div>
                    <h4 className="text-lg font-bold text-gray-900">분석 구간</h4>
                  </div>
                  <p className="text-sm text-gray-700">최근 4주 데이터 (Rolling 4 Weeks)</p>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-1 h-6 bg-green-600"></div>
                    <h4 className="text-lg font-bold text-gray-900">갱신 주기</h4>
                  </div>
                  <p className="text-sm text-gray-700">2주마다 자동 업데이트</p>
                </div>
              </div>

              {/* 작동 원리 */}
              <div className="mb-8">
                <h4 className="text-lg font-bold text-gray-900 mb-4">작동 원리</h4>
                <ol className="space-y-3 list-decimal list-inside">
                  <li className="text-sm text-gray-700 leading-relaxed">
                    2주마다 새로운 주차 데이터를 추가하고 가장 오래된 주차 데이터를 제거
                  </li>
                  <li className="text-sm text-gray-700 leading-relaxed">
                    최신 4주 데이터 기반으로 유사도 알고리즘 자동 재계산
                  </li>
                  <li className="text-sm text-gray-700 leading-relaxed">
                    시기별 판매 패턴 변화를 즉시 반영하여 정확한 유사 매장 추천
                  </li>
                </ol>
              </div>

              {/* 최신성 보장 */}
              <div className="bg-gray-50 border-l-4 border-green-600 p-5 rounded-r-lg">
                <div className="flex items-start gap-3">
                  <div className="w-1 h-6 bg-green-600 mt-1"></div>
                  <div>
                    <h4 className="text-sm font-bold text-gray-900 mb-2">최신성 보장:</h4>
                    <p className="text-sm text-gray-700 leading-relaxed">
                      Rolling Window 알고리즘을 통해 상권의 점진적이고 유동적인 변화를 실시간으로 포착하여 항상 최신 데이터 기반의 정확한 분석 결과를 제공합니다.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 동적 상권 포착 모달 - 실제 사례 */}
      {showDynamicAreaModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={() => setShowDynamicAreaModal(false)}>
          <div className="bg-white rounded-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b-2 border-gray-300 px-6 py-4 flex items-center justify-between z-10">
              <h3 className="text-2xl font-bold text-gray-900">실제 사례</h3>
              <button
                onClick={() => setShowDynamicAreaModal(false)}
                className="ml-4 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-6 md:p-8 space-y-12">
              {/* 사례 1: 석촌동호수점 */}
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <span className="text-xl font-bold text-green-600">1</span>
                  <h4 className="text-xl font-bold text-gray-900">실제 사례 석촌동호수점</h4>
                </div>
                
                <div className="grid md:grid-cols-2 gap-6 mb-6">
                  {/* 1월 (비수기) */}
                  <div>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-1 h-6 bg-green-600"></div>
                      <h5 className="text-lg font-bold text-gray-900">1월 (비수기)</h5>
                    </div>
                    <div className="bg-gray-50 border border-gray-300 rounded-lg p-5 space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 bg-green-600 rounded-full mt-2 flex-shrink-0"></div>
                        <p className="text-sm font-semibold text-gray-900">대로변 상권</p>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 bg-green-600 rounded-full mt-2 flex-shrink-0"></div>
                        <p className="text-sm font-semibold text-gray-900">상업형/생활형</p>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 bg-green-600 rounded-full mt-2 flex-shrink-0"></div>
                        <p className="text-sm font-semibold text-gray-900">식당가 중심</p>
                      </div>
                    </div>
                  </div>

                  {/* 4월 (성수기) */}
                  <div>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-1 h-6 bg-green-600"></div>
                      <h5 className="text-lg font-bold text-gray-900">4월 (성수기)</h5>
                    </div>
                    <div className="bg-gray-50 border border-gray-300 rounded-lg p-5 space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 bg-green-600 rounded-full mt-2 flex-shrink-0"></div>
                        <p className="text-sm font-semibold text-gray-900">한강 주변 상권</p>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 bg-green-600 rounded-full mt-2 flex-shrink-0"></div>
                        <p className="text-sm font-semibold text-gray-900">관광 수요 중심</p>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 bg-green-600 rounded-full mt-2 flex-shrink-0"></div>
                        <p className="text-sm font-semibold text-gray-900">공원가 특성</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 사례 2: 역삼만남점 */}
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <span className="text-xl font-bold text-green-600">2</span>
                  <h4 className="text-xl font-bold text-gray-900">실제 사례 역삼만남점</h4>
                </div>
                
                <div className="grid md:grid-cols-2 gap-6 mb-6">
                  {/* 12월 (입시 종료) */}
                  <div>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-1 h-6 bg-green-600"></div>
                      <h5 className="text-lg font-bold text-gray-900">12월 (입시 종료)</h5>
                    </div>
                    <div className="bg-gray-50 border border-gray-300 rounded-lg p-5 space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 bg-green-600 rounded-full mt-2 flex-shrink-0"></div>
                        <p className="text-sm font-semibold text-gray-900">유흥가 상권</p>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 bg-green-600 rounded-full mt-2 flex-shrink-0"></div>
                        <p className="text-sm font-semibold text-gray-900">역삼역 환승 중심</p>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 bg-green-600 rounded-full mt-2 flex-shrink-0"></div>
                        <p className="text-sm font-semibold text-gray-900">야간 고객 중심</p>
                      </div>
                    </div>
                  </div>

                  {/* 7월 (재수생 유입) */}
                  <div>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-1 h-6 bg-green-600"></div>
                      <h5 className="text-lg font-bold text-gray-900">7월 (재수생 유입)</h5>
                    </div>
                    <div className="bg-gray-50 border border-gray-300 rounded-lg p-5 space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 bg-green-600 rounded-full mt-2 flex-shrink-0"></div>
                        <p className="text-sm font-semibold text-gray-900">대학 정문 상권</p>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 bg-green-600 rounded-full mt-2 flex-shrink-0"></div>
                        <p className="text-sm font-semibold text-gray-900">학생 중심</p>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 bg-green-600 rounded-full mt-2 flex-shrink-0"></div>
                        <p className="text-sm font-semibold text-gray-900">주중 낮 시간대 활성</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}

