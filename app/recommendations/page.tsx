'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
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
  cost: number | null
  sale_price: number | null
  rec_reason: string | null
}

interface GroupedProducts {
  [key: string]: Product[]
}

export default function RecommendationsPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const urlStoreCode = searchParams.get('storeCode') || ''
  
  const [recommendedProducts, setRecommendedProducts] = useState<Product[]>([])
  const [excludedProducts, setExcludedProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [storeName, setStoreName] = useState<string>('')
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [activeTab, setActiveTab] = useState<'recommended' | 'excluded'>('recommended')
  const [visibleItems, setVisibleItems] = useState<Set<string>>(new Set())
  const [selectedLargeCategory, setSelectedLargeCategory] = useState<string | null>(null)

  useEffect(() => {
    // URL에서 storeCode 가져오기, 없으면 sessionStorage에서 가져오기
    let storeCode = urlStoreCode
    if (!storeCode && typeof window !== 'undefined') {
      storeCode = sessionStorage.getItem('storeCode') || ''
    }

    if (!storeCode) {
      router.push('/')
      return
    }

    // URL에 storeCode가 없으면 sessionStorage에서 가져온 값으로 URL 업데이트
    if (!urlStoreCode && storeCode) {
      router.replace(`/recommendations?storeCode=${encodeURIComponent(storeCode)}`)
      return
    }

    fetchStoreData(storeCode)
    // 탭 변경 시 visibleItems 초기화
    setVisibleItems(new Set())
  }, [urlStoreCode, router, activeTab])

  const fetchStoreData = async (code: string) => {
    setLoading(true)
    setError(null)

    try {
      // 알려진 매장명 목록
      const knownStores = ['대치본점', '대치은마사거리점']
      
      let foundStoreName: string | null = null
      let recommendedTable: string | null = null
      let excludedTable: string | null = null
      let lastError: any = null

      // 각 매장명으로 테이블을 시도
      for (const storeName of knownStores) {
        const recTable = `${storeName}_추천상품`
        const excTable = `${storeName}_부진재고`

        try {
          // storecode를 문자열과 숫자 둘 다 시도
          const codeVariants = [code, code.toString(), parseInt(code).toString()]
          
          for (const codeVariant of codeVariants) {
            // 추천상품 테이블 확인
            const { data: recData, error: recError } = await supabase
              .from(recTable)
              .select('store_nm, store_code')
              .eq('store_code', codeVariant)
              .limit(1)

            if (recError) {
              // 테이블이 존재하지 않거나 접근 권한이 없는 경우
              console.log(`테이블 ${recTable} (storecode: ${codeVariant}) 조회 실패:`, recError.message)
              if (!lastError) lastError = recError
              continue
            }

            if (recData && recData.length > 0) {
              foundStoreName = recData[0].store_nm || storeName
              recommendedTable = recTable
              excludedTable = excTable
              break
            }
          }
          
          if (foundStoreName) break
        } catch (tableError: any) {
          console.log(`테이블 ${recTable} 접근 오류:`, tableError.message)
          if (!lastError) lastError = tableError
          continue
        }
      }

      if (!foundStoreName || !recommendedTable) {
        console.error('마지막 오류:', lastError)
        setError(`매장 코드 ${code}에 해당하는 데이터를 찾을 수 없습니다. 테이블이 존재하는지 확인해주세요.`)
        setLoading(false)
        return
      }

      setStoreName(foundStoreName)

      // 추천 상품 조회 - rank 순서로 정렬
      const { data: recommendedData, error: recommendedError } = await supabase
        .from(recommendedTable)
        .select('*')
        .eq('store_code', code)
        .order('rank', { ascending: true })

      if (recommendedError) {
        console.error('추천 상품 조회 오류:', recommendedError)
      } else {
        setRecommendedProducts(recommendedData || [])
      }

      // 부진재고 조회 - rank 순서로 정렬
      let excludedData: Product[] = []
      if (excludedTable) {
        const { data: excludedDataResult, error: excludedError } = await supabase
          .from(excludedTable)
          .select('*')
          .eq('store_code', code)
          .order('rank', { ascending: true })

        if (excludedError) {
          console.error('부진재고 조회 오류:', excludedError)
        } else {
          excludedData = excludedDataResult || []
          setExcludedProducts(excludedData)
        }
      }

      if (recommendedError) {
        setError(`추천 상품을 불러오는 중 오류가 발생했습니다: ${recommendedError.message}`)
      } else if (recommendedData && recommendedData.length === 0 && excludedData.length === 0) {
        setError('해당 매장 코드에 대한 데이터가 없습니다.')
      }

    } catch (err: any) {
      console.error('데이터 조회 중 오류:', err)
      setError(`데이터를 불러오는 중 오류가 발생했습니다: ${err.message || '알 수 없는 오류'}`)
    } finally {
      setLoading(false)
    }
  }

  // 중분류별로 그룹화하고 각 그룹 내에서 rank 순서로 정렬
  const groupedRecommendedProducts = useMemo(() => {
    const grouped: GroupedProducts = {}
    
    recommendedProducts.forEach((product) => {
      const category = product.item_mddv_nm || '기타'
      if (!grouped[category]) {
        grouped[category] = []
      }
      grouped[category].push(product)
    })

    // 각 카테고리 내에서 rank 순서로 정렬
    Object.keys(grouped).forEach((category) => {
      grouped[category].sort((a, b) => {
        const rankA = a.rank ?? Infinity
        const rankB = b.rank ?? Infinity
        return rankA - rankB
      })
    })

    return grouped
  }, [recommendedProducts])

  const groupedExcludedProducts = useMemo(() => {
    const grouped: GroupedProducts = {}
    
    excludedProducts.forEach((product) => {
      const category = product.item_mddv_nm || '기타'
      if (!grouped[category]) {
        grouped[category] = []
      }
      grouped[category].push(product)
    })

    // 각 카테고리 내에서 rank 순서로 정렬
    Object.keys(grouped).forEach((category) => {
      grouped[category].sort((a, b) => {
        const rankA = a.rank ?? Infinity
        const rankB = b.rank ?? Infinity
        return rankA - rankB
      })
    })

    return grouped
  }, [excludedProducts])

  // 대분류 목록 추출
  const largeCategories = useMemo(() => {
    const currentProducts = activeTab === 'recommended' ? recommendedProducts : excludedProducts
    const categories = new Set<string>()
    currentProducts.forEach((product) => {
      if (product.item_lrdv_nm) {
        categories.add(product.item_lrdv_nm)
      }
    })
    return Array.from(categories).sort()
  }, [recommendedProducts, excludedProducts, activeTab])

  const totalRecommendedProducts = recommendedProducts.length
  const totalExcludedProducts = excludedProducts.length
  const currentGroupedProducts = activeTab === 'recommended' ? groupedRecommendedProducts : groupedExcludedProducts
  const totalProducts = activeTab === 'recommended' ? totalRecommendedProducts : totalExcludedProducts

  // 선택된 대분류에 따라 필터링된 중분류 그룹
  const filteredGroupedProducts = useMemo(() => {
    if (!selectedLargeCategory) {
      return currentGroupedProducts
    }

    const filtered: GroupedProducts = {}
    const currentProducts = activeTab === 'recommended' ? recommendedProducts : excludedProducts
    
    currentProducts.forEach((product) => {
      if (product.item_lrdv_nm === selectedLargeCategory) {
        const category = product.item_mddv_nm || '기타'
        if (!filtered[category]) {
          filtered[category] = []
        }
        filtered[category].push(product)
      }
    })

    // 각 카테고리 내에서 rank 순서로 정렬
    Object.keys(filtered).forEach((category) => {
      filtered[category].sort((a, b) => {
        const rankA = a.rank ?? Infinity
        const rankB = b.rank ?? Infinity
        return rankA - rankB
      })
    })

    return filtered
  }, [selectedLargeCategory, activeTab, currentGroupedProducts, recommendedProducts, excludedProducts])

  // 탭 변경 시 대분류 선택 초기화
  useEffect(() => {
    setSelectedLargeCategory(null)
  }, [activeTab])

  // Intersection Observer로 뷰포트에 들어온 아이템 추적
  const observerRef = useRef<IntersectionObserver | null>(null)
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  const handleIntersection = useCallback((entries: IntersectionObserverEntry[]) => {
    entries.forEach((entry) => {
      const itemId = entry.target.getAttribute('data-item-id')
      if (!itemId) return

      if (entry.isIntersecting) {
        // 뷰포트에 들어오면 표시
        setVisibleItems((prev) => new Set(prev).add(itemId))
      } else {
        // 뷰포트에서 벗어나면 제거 (메모리 절약)
        setVisibleItems((prev) => {
          const next = new Set(prev)
          next.delete(itemId)
          return next
        })
      }
    })
  }, [])

  useEffect(() => {
    // Observer 초기화 - 뷰포트 근처 100px 전에만 미리 로드
    observerRef.current = new IntersectionObserver(handleIntersection, {
      rootMargin: '100px', // 뷰포트 밖 100px 전에 미리 로드
      threshold: 0.01, // 1%만 보여도 로드
    })

    // 모든 아이템 요소 관찰
    itemRefs.current.forEach((element) => {
      if (element) {
        observerRef.current?.observe(element)
      }
    })

    return () => {
      observerRef.current?.disconnect()
    }
  }, [handleIntersection, currentGroupedProducts])

  // 아이템 ref 등록 함수
  const setItemRef = useCallback((itemId: string, element: HTMLDivElement | null) => {
    if (element) {
      itemRefs.current.set(itemId, element)
      if (observerRef.current) {
        observerRef.current.observe(element)
      }
    } else {
      itemRefs.current.delete(itemId)
    }
  }, [])

  if (loading) {
    return (
      <Layout>
        <div className="p-4 md:p-8">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-10 w-10 md:h-12 md:w-12 border-b-2 border-green-500 mb-4"></div>
              <p className="text-sm md:text-base text-gray-600">데이터를 불러오는 중...</p>
            </div>
          </div>
        </div>
      </Layout>
    )
  }

  if (error) {
    return (
      <Layout>
        <div className="p-4 md:p-8">
          <div className="max-w-6xl mx-auto">
            <div className="bg-red-50 border border-red-300 rounded-lg p-4 md:p-6 text-center">
              <p className="text-sm md:text-base text-red-600 mb-4">{error}</p>
              <button
                onClick={() => router.push('/')}
                className="px-4 md:px-6 py-2 bg-green-500 hover:bg-green-600 text-white text-sm md:text-base rounded-lg transition-colors"
              >
                돌아가기
              </button>
            </div>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="min-h-screen bg-white">
        <div className="max-w-7xl mx-auto px-3 md:px-4 py-4 md:py-6">
          {/* 헤더 */}
          <div className="mb-4 md:mb-6">
            {/* 탭 */}
            <div className="flex gap-2 md:gap-4 mb-4 md:mb-6 border-b border-gray-200 overflow-x-auto">
              <button
                onClick={() => setActiveTab('recommended')}
                className={`pb-3 px-3 md:px-4 font-semibold text-sm md:text-base transition-colors whitespace-nowrap ${
                  activeTab === 'recommended'
                    ? 'text-green-500 border-b-2 border-green-500'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                추천 상품 ({totalRecommendedProducts})
              </button>
              <button
                onClick={() => setActiveTab('excluded')}
                className={`pb-3 px-3 md:px-4 font-semibold text-sm md:text-base transition-colors whitespace-nowrap ${
                  activeTab === 'excluded'
                    ? 'text-green-600 border-b-2 border-green-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                부진재고 ({totalExcludedProducts})
              </button>
            </div>

            {/* 대분류 카테고리 */}
            {largeCategories.length > 0 && (
              <div className="mb-4 md:mb-6">
                <h3 className="text-base md:text-lg font-bold text-gray-900 mb-2 md:mb-3">대분류 카테고리</h3>
                <div className="flex gap-2 md:gap-3 overflow-x-auto pb-2 scrollbar-hide">
                  <button
                    onClick={() => setSelectedLargeCategory(null)}
                    className={`px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-sm md:text-base font-medium whitespace-nowrap transition-colors ${
                      selectedLargeCategory === null
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    전체
                  </button>
                  {largeCategories.map((category) => (
                    <button
                      key={category}
                      onClick={() => setSelectedLargeCategory(category)}
                      className={`px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-sm md:text-base font-medium whitespace-nowrap transition-colors ${
                        selectedLargeCategory === category
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {category}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-3 md:mb-4">
              <div className="flex items-center gap-3 md:gap-4">
                <span className="text-sm md:text-base text-gray-600">전체 {totalProducts}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm md:text-base text-gray-900 font-semibold">추천순</span>
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
              <button className="flex items-center gap-2 text-sm md:text-base text-gray-600 hover:text-gray-900 transition-colors">
                <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                <span>필터</span>
              </button>
            </div>
            <p className="text-xs md:text-sm text-gray-600 mb-3 md:mb-0">
              매장: <span className="text-green-500">{storeName}</span> | 
              매장 코드: <span className="text-green-500">{urlStoreCode || (typeof window !== 'undefined' ? sessionStorage.getItem('storeCode') || '' : '')}</span>
            </p>
          </div>

          {/* 안내 문구 - 탭별로 표시 */}
          {activeTab === 'recommended' && (
            <div className="bg-green-50 border-l-4 border-green-500 p-3 md:p-4 mb-4 md:mb-6 rounded-r-lg">
              <p className="text-sm md:text-base text-gray-800 leading-relaxed">
                <span className="font-semibold text-green-600">점주님의 매장과 유사한 고객 패턴, 상권, 매출을 가진 매장</span>에서 
                <span className="font-semibold"> 인기 있는 상품</span>입니다. 
                점주님도 함께 취급해보시는 것을 추천드립니다.
              </p>
            </div>
          )}

          {activeTab === 'excluded' && (
            <div className="bg-orange-50 border-l-4 border-orange-500 p-3 md:p-4 mb-4 md:mb-6 rounded-r-lg">
              <p className="text-sm md:text-base text-gray-800 leading-relaxed">
                <span className="font-semibold text-orange-600">점주님의 매장에서 중분류별로 발주 제외를 권장드리는 상품</span>입니다. 
                매장 운영 효율화를 위해 참고해 주시기 바랍니다.
              </p>
            </div>
          )}

          {/* 중분류별 상품 그룹 */}
          {Object.keys(filteredGroupedProducts).length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600">
                {activeTab === 'recommended' ? '추천 상품이 없습니다.' : '부진재고가 없습니다.'}
              </p>
            </div>
          ) : (
            <div className="space-y-8 md:space-y-12">
              {Object.entries(filteredGroupedProducts).map(([category, products]) => (
                <div key={category}>
                  <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-3 md:mb-4">{category}</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-4">
                    {products.map((product) => {
                      const itemId = `${product.store_code}-${product.item_cd}`
                      const isVisible = visibleItems.has(itemId)
                      
                      return (
                        <div
                          key={itemId}
                          ref={(el) => setItemRef(itemId, el)}
                          data-item-id={itemId}
                          onClick={() => setSelectedProduct(product)}
                          className={`bg-white rounded-lg overflow-hidden border transition-colors cursor-pointer shadow-sm hover:shadow-md active:scale-95 ${
                            activeTab === 'recommended'
                              ? 'border-gray-200 hover:border-green-400'
                              : 'border-gray-200 hover:border-green-500'
                          }`}
                          style={{ minHeight: '280px' }}
                        >
                          {isVisible ? (
                            <>
                              {/* 상품 이미지 */}
                              <div className="relative aspect-square bg-white overflow-hidden flex items-center justify-center">
                                {product.item_img ? (
                                  <img
                                    src={product.item_img}
                                    alt={product.item_nm}
                                    className="w-full h-full object-contain p-2"
                                    loading="lazy"
                                    onError={(e) => {
                                      // 에러 발생 시 placeholder 표시
                                      e.currentTarget.style.display = 'none'
                                      const parent = e.currentTarget.parentElement
                                      if (parent && !parent.querySelector('.image-placeholder')) {
                                        const placeholder = document.createElement('div')
                                        placeholder.className = 'image-placeholder w-full h-full flex items-center justify-center text-gray-400 text-sm'
                                        placeholder.textContent = '이미지 없음'
                                        parent.appendChild(placeholder)
                                      }
                                    }}
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
                                    이미지 없음
                                  </div>
                                )}
                              </div>

                              {/* 상품 정보 */}
                              <div className="p-2 md:p-3">
                                <h4 className="text-xs md:text-sm font-semibold text-gray-900 mb-1 md:mb-2 line-clamp-2 min-h-[2rem] md:min-h-[2.5rem]">
                                  {product.item_nm}
                                </h4>
                                
                                {/* 가격 정보 */}
                                <div className="mb-1 md:mb-2">
                                  {product.sale_price !== null && (
                                    <div className="text-sm md:text-base font-bold text-green-500">
                                      {product.sale_price.toLocaleString()}원
                                    </div>
                                  )}
                                  {product.cost !== null && product.sale_price !== null && (
                                    <div className="text-xs text-gray-500 mt-0.5 md:mt-1">
                                      원가: {product.cost.toLocaleString()}원
                                    </div>
                                  )}
                                </div>

                                {/* 상태 및 액션 버튼 */}
                                <div className="flex items-center justify-between mt-2 md:mt-3">
                                  <span className="text-xs text-gray-600 bg-gray-100 px-1.5 md:px-2 py-0.5 md:py-1 rounded">
                                    냉동
                                  </span>
                                  <button
                                    className={`p-1.5 md:p-2 rounded-full transition-colors ${
                                      activeTab === 'recommended'
                                        ? 'bg-green-500 hover:bg-green-600'
                                        : 'bg-green-600 hover:bg-green-700'
                                    }`}
                                  >
                                    <svg className="w-3.5 h-3.5 md:w-4 md:h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                            </>
                          ) : (
                            // 경량 플레이스홀더 - 스크롤 전까지 표시
                            <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50" style={{ minHeight: '280px' }}>
                              <div className="w-12 h-12 md:w-16 md:h-16 bg-gray-200 rounded-lg mb-2 animate-pulse"></div>
                              <div className="w-3/4 h-3 bg-gray-200 rounded mb-1 animate-pulse"></div>
                              <div className="w-1/2 h-3 bg-gray-200 rounded animate-pulse"></div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 스크롤 투 탑 버튼 */}
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="fixed bottom-4 right-4 md:bottom-6 md:right-6 w-10 h-10 md:w-12 md:h-12 bg-green-500 hover:bg-green-600 rounded-full flex items-center justify-center shadow-lg transition-colors z-10"
            aria-label="맨 위로"
          >
            <svg className="w-5 h-5 md:w-6 md:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
          </button>

          {/* 추천 근거 모달 */}
          {selectedProduct && (
            <div
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 md:p-4"
              onClick={() => setSelectedProduct(null)}
            >
              <div
                className="bg-white rounded-lg border border-gray-200 max-w-2xl w-full max-h-[90vh] md:max-h-[80vh] overflow-y-auto shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-4 md:p-6">
                  <div className="flex items-start justify-between mb-3 md:mb-4">
                    <div className="flex-1 pr-2">
                      <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-2">{selectedProduct.item_nm}</h3>
                      {selectedProduct.item_mddv_nm && (
                        <span className="text-xs md:text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded">
                          {selectedProduct.item_mddv_nm}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => setSelectedProduct(null)}
                      className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
                      aria-label="닫기"
                    >
                      <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {selectedProduct.item_img && (
                    <div className="mb-3 md:mb-4 relative w-full h-48 md:h-64 rounded-lg overflow-hidden bg-white flex items-center justify-center">
                      <img
                        src={selectedProduct.item_img}
                        alt={selectedProduct.item_nm}
                        className="w-full h-full object-contain p-3 md:p-4 rounded-lg"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                          const parent = e.currentTarget.parentElement
                          if (parent && !parent.querySelector('.image-placeholder')) {
                            const placeholder = document.createElement('div')
                            placeholder.className = 'image-placeholder w-full h-full flex items-center justify-center text-gray-400 text-sm'
                            placeholder.textContent = '이미지 없음'
                            parent.appendChild(placeholder)
                          }
                        }}
                      />
                    </div>
                  )}

                  <div className="space-y-3 md:space-y-4">
                    <div>
                      <h4 className="text-xs md:text-sm font-semibold text-gray-700 mb-2">가격 정보</h4>
                      <div className="bg-gray-50 rounded-lg p-2 md:p-3">
                        {selectedProduct.sale_price !== null && (
                          <div className="text-base md:text-lg font-bold text-green-500 mb-1">
                            판매가: {selectedProduct.sale_price.toLocaleString()}원
                          </div>
                        )}
                        {selectedProduct.cost !== null && (
                          <div className="text-xs md:text-sm text-gray-600">
                            원가: {selectedProduct.cost.toLocaleString()}원
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-xs md:text-sm font-semibold text-gray-700 mb-2">
                        {activeTab === 'recommended' ? '추천 근거' : '부진 근거'}
                      </h4>
                      <div className="bg-gray-50 rounded-lg p-3 md:p-4">
                        {selectedProduct.rec_reason ? (
                          <p className="text-sm md:text-base text-gray-900 leading-relaxed whitespace-pre-wrap">
                            {selectedProduct.rec_reason}
                          </p>
                        ) : (
                          <p className="text-gray-500">
                            {activeTab === 'recommended' ? '추천 근거가 없습니다.' : '부진 근거가 없습니다.'}
                          </p>
                        )}
                      </div>
                    </div>

                    {selectedProduct.rank !== null && (
                      <div className="text-sm text-gray-600">
                        추천 순위: <span className="text-green-500 font-semibold">{selectedProduct.rank}위</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}

