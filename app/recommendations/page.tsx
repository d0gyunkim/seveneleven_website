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
  item_smdv_nm: string | null
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

  // R, F, M 값 추출 함수
  const extractRFMValues = useCallback((recReason: string | null) => {
    if (!recReason) return { r: null, f: null, m: null }
    
    // R 값: "일" 단위로 끝나는 숫자 찾기
    const rMatch = recReason.match(/(\d+\.?\d*)\s*일/)
    const rValue = rMatch ? parseFloat(rMatch[1]) : null
    
    // F 값: "회" 단위로 끝나는 숫자 찾기
    const fMatch = recReason.match(/(\d+\.?\d*)\s*회/)
    const fValue = fMatch ? parseFloat(fMatch[1]) : null
    
    // M 값: "원" 앞의 숫자 찾기 (천단위 구분자 제거)
    const mMatch = recReason.match(/([\d,]+)\s*원/)
    const mValue = mMatch ? parseFloat(mMatch[1].replace(/,/g, '')) : null
    
    return { r: rValue, f: fValue, m: mValue }
  }, [])

  // 중분류별로 그룹화하고 각 그룹 내에서 rank 순서로 정렬
  // 상품명이 동일한 경우 판매가가 큰 것만 표시
  // R, F, M 값 중 하나라도 0이면 제외
  const groupedRecommendedProducts = useMemo(() => {
    const grouped: GroupedProducts = {}
    
    // R, F, M 값 중 하나라도 0이 있는 상품 제외
    const filteredProducts = recommendedProducts.filter((product) => {
      const { r, f, m } = extractRFMValues(product.rec_reason)
      // R, F, M 값 중 하나라도 0이면 제외
      return !(r === 0 || f === 0 || m === 0)
    })
    
    filteredProducts.forEach((product) => {
      const category = product.item_mddv_nm || '기타'
      if (!grouped[category]) {
        grouped[category] = []
      }
      grouped[category].push(product)
    })

    // 각 카테고리 내에서 상품명별로 필터링 및 정렬
    Object.keys(grouped).forEach((category) => {
      const products = grouped[category]
      
      // 상품명별로 그룹화하고 판매가가 큰 것만 선택
      const productMap = new Map<string, Product>()
      products.forEach((product) => {
        const itemName = product.item_nm
        const existingProduct = productMap.get(itemName)
        
        if (!existingProduct) {
          productMap.set(itemName, product)
        } else {
          // 기존 상품과 비교하여 판매가가 큰 것 선택
          const currentPrice = product.sale_price ?? 0
          const existingPrice = existingProduct.sale_price ?? 0
          if (currentPrice > existingPrice) {
            productMap.set(itemName, product)
          }
        }
      })
      
      // 필터링된 상품들을 배열로 변환하고 rank 순서로 정렬
      grouped[category] = Array.from(productMap.values()).sort((a, b) => {
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

    // 각 카테고리 내에서 상품명별로 필터링 및 정렬
    Object.keys(grouped).forEach((category) => {
      const products = grouped[category]
      
      // 상품명별로 그룹화하고 판매가가 큰 것만 선택
      const productMap = new Map<string, Product>()
      products.forEach((product) => {
        const itemName = product.item_nm
        const existingProduct = productMap.get(itemName)
        
        if (!existingProduct) {
          productMap.set(itemName, product)
        } else {
          // 기존 상품과 비교하여 판매가가 큰 것 선택
          const currentPrice = product.sale_price ?? 0
          const existingPrice = existingProduct.sale_price ?? 0
          if (currentPrice > existingPrice) {
            productMap.set(itemName, product)
          }
        }
      })
      
      // 필터링된 상품들을 배열로 변환하고 rank 순서로 정렬
      grouped[category] = Array.from(productMap.values()).sort((a, b) => {
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

  // 추천 상품에서 대분류별 중분류 순서 추출 (최초 등장 순서 기준)
  const recommendedCategoryOrder = useMemo(() => {
    const orderMap = new Map<string, string[]>()
    
    // 대분류별로 중분류 순서 저장
    recommendedProducts.forEach((product) => {
      const largeCategory = product.item_lrdv_nm
      const middleCategory = product.item_mddv_nm || '기타'
      
      if (largeCategory) {
        if (!orderMap.has(largeCategory)) {
          orderMap.set(largeCategory, [])
        }
        
        const middleCategories = orderMap.get(largeCategory)!
        if (!middleCategories.includes(middleCategory)) {
          middleCategories.push(middleCategory)
        }
      }
    })
    
    return orderMap
  }, [recommendedProducts])

  // 선택된 대분류에 따라 필터링된 중분류 그룹
  const filteredGroupedProducts = useMemo(() => {
    // 대분류가 선택되지 않았으면 빈 객체 반환
    if (!selectedLargeCategory) {
      return {}
    }

    const filtered: GroupedProducts = {}
    let currentProducts = activeTab === 'recommended' ? recommendedProducts : excludedProducts
    
    // 추천 상품인 경우 R, F, M 값 중 하나라도 0이 있는 상품 제외
    if (activeTab === 'recommended') {
      currentProducts = currentProducts.filter((product) => {
        const { r, f, m } = extractRFMValues(product.rec_reason)
        // R, F, M 값 중 하나라도 0이면 제외
        return !(r === 0 || f === 0 || m === 0)
      })
    }
    
    currentProducts.forEach((product) => {
      if (product.item_lrdv_nm === selectedLargeCategory) {
        const category = product.item_mddv_nm || '기타'
        if (!filtered[category]) {
          filtered[category] = []
        }
        filtered[category].push(product)
      }
    })

    // 각 카테고리 내에서 상품명별로 필터링 및 정렬
    Object.keys(filtered).forEach((category) => {
      const products = filtered[category]
      
      // 상품명별로 그룹화하고 판매가가 큰 것만 선택
      const productMap = new Map<string, Product>()
      products.forEach((product) => {
        const itemName = product.item_nm
        const existingProduct = productMap.get(itemName)
        
        if (!existingProduct) {
          productMap.set(itemName, product)
        } else {
          // 기존 상품과 비교하여 판매가가 큰 것 선택
          const currentPrice = product.sale_price ?? 0
          const existingPrice = existingProduct.sale_price ?? 0
          if (currentPrice > existingPrice) {
            productMap.set(itemName, product)
          }
        }
      })
      
      let sortedProducts: Product[]
      
      if (activeTab === 'excluded') {
        // 부진재고: rank 0부터, rank가 같으면 판매가가 작은 순으로 정렬
        sortedProducts = Array.from(productMap.values()).sort((a, b) => {
        const rankA = a.rank ?? Infinity
        const rankB = b.rank ?? Infinity
          
          // rank가 같으면 판매가가 작은 순으로
          if (rankA === rankB) {
            const priceA = a.sale_price ?? 0
            const priceB = b.sale_price ?? 0
            return priceA - priceB
          }
          
          // rank 순서대로 (0 -> 1 -> 2 ...)
        return rankA - rankB
      })
        
        // 중분류별로 최대 5개만 선택
        sortedProducts = sortedProducts.slice(0, 5)
      } else {
        // 추천 상품: 기존 로직 유지 (rank 순서로 정렬)
        sortedProducts = Array.from(productMap.values()).sort((a, b) => {
          const rankA = a.rank ?? Infinity
          const rankB = b.rank ?? Infinity
          return rankA - rankB
        })
      }
      
      filtered[category] = sortedProducts
    })

    // 추천 상품의 중분류 순서 기준으로 정렬
    const recommendedOrder = recommendedCategoryOrder.get(selectedLargeCategory) || []
    const sortedFiltered: GroupedProducts = {}
    
    // 추천 상품에 있는 중분류를 먼저 순서대로 추가
    const sortedKeys: string[] = []
    
    // 1. 추천 상품에 있는 중분류를 순서대로 추가
    recommendedOrder.forEach(category => {
      if (filtered[category]) {
        sortedKeys.push(category)
      }
    })
    
    // 2. 추천 상품에 없는 중분류를 맨 뒤에 추가
    Object.keys(filtered).forEach(category => {
      if (!recommendedOrder.includes(category)) {
        sortedKeys.push(category)
      }
    })
    
    sortedKeys.forEach(key => {
      sortedFiltered[key] = filtered[key]
    })

    return sortedFiltered
  }, [selectedLargeCategory, activeTab, recommendedProducts, excludedProducts, recommendedCategoryOrder])

  // 탭 변경 시 대분류 선택 초기화 (첫 번째 대분류로 설정)
  useEffect(() => {
    const currentCategories = activeTab === 'recommended' 
      ? recommendedProducts 
      : excludedProducts
    const categories = new Set<string>()
    currentCategories.forEach((product) => {
      if (product.item_lrdv_nm) {
        categories.add(product.item_lrdv_nm)
      }
    })
    const sortedCategories = Array.from(categories).sort()
    if (sortedCategories.length > 0) {
      setSelectedLargeCategory(sortedCategories[0])
    } else {
      setSelectedLargeCategory(null)
    }
  }, [activeTab, recommendedProducts, excludedProducts])

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
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="relative inline-block mb-6">
              <div className="absolute inset-0 bg-green-500/20 rounded-full animate-ping"></div>
              <div className="relative inline-block animate-spin rounded-full h-16 w-16 md:h-20 md:w-20 border-4 border-gray-200 border-t-green-500"></div>
            </div>
            <p className="text-base md:text-lg text-gray-700 font-medium">데이터를 불러오는 중...</p>
            <p className="text-sm text-gray-500 mt-2">잠시만 기다려주세요</p>
          </div>
        </div>
      </Layout>
    )
  }

  if (error) {
    return (
      <Layout>
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 flex items-center justify-center p-4">
          <div className="max-w-2xl w-full">
            <div className="bg-white border-2 border-red-200 rounded-2xl p-6 md:p-8 text-center shadow-xl">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-4">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-3">오류가 발생했습니다</h3>
              <p className="text-sm md:text-base text-red-600 mb-6 leading-relaxed">{error}</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={() => router.push('/')}
                  className="px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white text-sm md:text-base font-semibold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  홈으로 돌아가기
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="px-6 py-3 bg-white border-2 border-gray-300 hover:border-gray-400 text-gray-700 text-sm md:text-base font-semibold rounded-xl transition-all duration-200"
                >
                  새로고침
                </button>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8">
          {/* 헤더 섹션 */}
          <div className="mb-6 md:mb-8">
            {/* 페이지 제목 */}
            <div className="mb-8 md:mb-10 border-b border-gray-200 pb-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-baseline gap-4 mb-3">
                    <div className="w-1 h-10 bg-green-600"></div>
                    <div>
                      <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
                        {storeName && `${storeName} 상품 추천`}
                      </h1>
                      <p className="text-xs text-gray-500 mt-1 font-medium">PRODUCT RECOMMENDATION SYSTEM</p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed max-w-2xl ml-6">
                    데이터 기반 맞춤형 상품 추천 및 발주 최적화 인사이트 제공
                  </p>
                </div>
              </div>
            </div>

            {/* 탭 */}
            <div className="flex items-center gap-3 flex-wrap mb-6 md:mb-8">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">분석 유형</span>
              <button
                onClick={() => setActiveTab('recommended')}
                className={`px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap border ${
                  activeTab === 'recommended'
                    ? 'bg-green-600 text-white border-green-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-green-400 hover:text-green-600'
                }`}
              >
                추천 상품
              </button>
              <button
                onClick={() => setActiveTab('excluded')}
                className={`px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap border ${
                  activeTab === 'excluded'
                    ? 'bg-orange-600 text-white border-orange-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-orange-400 hover:text-orange-600'
                }`}
              >
                부진재고
              </button>
            </div>

            {/* 대분류 카테고리 */}
            {largeCategories.length > 0 && (
              <div className="mb-6 md:mb-8">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">상품 카테고리</h3>
                  <span className="text-xs text-gray-500 font-medium">{largeCategories.length}개 카테고리</span>
                </div>
                <div className="flex gap-2 md:gap-3 overflow-x-auto pb-3 scrollbar-hide scroll-smooth">
                  {largeCategories.map((category) => (
                    <button
                      key={category}
                      onClick={() => setSelectedLargeCategory(category)}
                      className={`px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap border ${
                        selectedLargeCategory === category
                          ? activeTab === 'recommended'
                            ? 'bg-green-600 text-white border-green-600'
                            : 'bg-orange-600 text-white border-orange-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-green-400 hover:text-green-600'
                      }`}
                    >
                      {category}
                    </button>
                  ))}
                </div>
              </div>
            )}

          </div>

          {/* 안내 문구 - 탭별로 표시 */}
          {activeTab === 'recommended' && (
            <div className="bg-white border-2 border-gray-300 p-6 mb-6 md:mb-8">
              <div className="flex items-start gap-4 mb-4 border-b-2 border-gray-300 pb-4">
                <div className="w-1 h-8 bg-green-600"></div>
                <div className="flex-1">
                  <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-2">추천 상품 안내</h4>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    <span className="font-semibold text-green-700">{storeName} 점주님께 추천드리는</span> 내 매장과 유사한 상권/매출을 내는 매장에서 인기 있는 상품입니다.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'excluded' && (
            <div className="bg-white border-2 border-gray-300 p-6 mb-6 md:mb-8">
              <div className="flex items-start gap-4 mb-4 border-b-2 border-gray-300 pb-4">
                <div className="w-1 h-8 bg-orange-600"></div>
                <div className="flex-1">
                  <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-2">부진재고 안내</h4>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    <span className="font-semibold text-orange-700">내 매장의 상품군 별 발주 제외 권장 대상 상품</span>입니다. 
                    매장 운영 효율화 시 참고해 주시기 바랍니다.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 중분류별 상품 그룹 */}
          {Object.keys(filteredGroupedProducts).length === 0 ? (
            <div className="text-center py-20 bg-white border-2 border-gray-300">
              <div className="w-16 h-16 bg-gradient-to-br from-gray-200 to-gray-300 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">데이터 없음</h3>
              <p className="text-sm text-gray-600">
                {activeTab === 'recommended' ? '해당 카테고리의 추천 상품 데이터가 준비되지 않았습니다.' : '해당 카테고리의 부진재고 데이터가 준비되지 않았습니다.'}
              </p>
            </div>
          ) : (
            <div className="space-y-10 md:space-y-14">
              {Object.entries(filteredGroupedProducts).map(([category, products]) => (
                <div key={category}>
                  <div className="bg-white border border-gray-300 mb-6">
                    <div className="bg-gray-50 border-b border-gray-300 px-5 py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-baseline gap-4">
                          <div className={`w-1 h-6 ${
                            activeTab === 'recommended' ? 'bg-green-600' : 'bg-orange-600'
                          }`}></div>
                          <div>
                            <h3 className="text-base font-bold text-gray-900 uppercase tracking-wide">{category}</h3>
                            <p className="text-xs text-gray-500 mt-1">상품군별 분석 결과</p>
                          </div>
                        </div>
                        <div className="px-3 py-1.5 bg-white border border-gray-300">
                          <span className="text-sm text-gray-700 font-semibold">{products.length}개 상품</span>
                        </div>
                      </div>
                    </div>
                    <div className="p-5">
                      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4 lg:gap-5">
                    {products.map((product) => {
                      const itemId = `${product.store_code}-${product.item_cd}`
                      const isVisible = visibleItems.has(itemId)
                      
                      return (
                        <div
                          key={itemId}
                          ref={(el) => setItemRef(itemId, el)}
                          data-item-id={itemId}
                          onClick={() => setSelectedProduct(product)}
                          className={`group bg-white rounded-xl overflow-hidden border-2 transition-all duration-300 cursor-pointer flex flex-col relative ${
                            activeTab === 'recommended'
                              ? 'border-gray-100 hover:border-green-400 hover:shadow-xl hover:shadow-green-500/10 hover:-translate-y-1'
                              : 'border-gray-100 hover:border-orange-400 hover:shadow-xl hover:shadow-orange-500/10 hover:-translate-y-1'
                          } shadow-md hover:shadow-xl`}
                          style={{ minHeight: '300px' }}
                        >
                          {isVisible ? (
                            <>
                              {/* 순위 배지 */}
                              {product.rank !== null && product.rank <= 3 && (
                                <div className={`absolute top-2 left-2 z-10 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-lg ${
                                  product.rank === 1 ? 'bg-gradient-to-br from-yellow-400 to-yellow-600' :
                                  product.rank === 2 ? 'bg-gradient-to-br from-gray-300 to-gray-500' :
                                  'bg-gradient-to-br from-orange-400 to-orange-600'
                                }`}>
                                  {product.rank}
                                </div>
                              )}

                              {/* 상품 이미지 */}
                              <div className="relative aspect-square bg-gradient-to-br from-gray-50 to-gray-100 overflow-hidden flex items-center justify-center group-hover:bg-gradient-to-br group-hover:from-gray-100 group-hover:to-gray-200 transition-colors duration-300">
                                {product.item_img ? (
                                  <img
                                    src={product.item_img}
                                    alt={product.item_nm}
                                    className="w-full h-full object-contain p-3 md:p-4 transition-transform duration-300 group-hover:scale-105"
                                    loading="lazy"
                                    onError={(e) => {
                                      e.currentTarget.style.display = 'none'
                                      const parent = e.currentTarget.parentElement
                                      if (parent && !parent.querySelector('.image-placeholder')) {
                                        const placeholder = document.createElement('div')
                                        placeholder.className = 'image-placeholder w-full h-full flex flex-col items-center justify-center text-gray-400'
                                        placeholder.innerHTML = `
                                          <svg class="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                          </svg>
                                          <span class="text-xs">이미지 없음</span>
                                        `
                                        parent.appendChild(placeholder)
                                      }
                                    }}
                                  />
                                ) : (
                                  <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                                    <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    <span className="text-xs">이미지 없음</span>
                                  </div>
                                )}
                              </div>

                              {/* 상품 정보 */}
                              <div className="p-3 md:p-4 flex flex-col h-full bg-white">
                                <h4 className="text-xs md:text-sm font-semibold text-gray-900 mb-2 md:mb-3 line-clamp-2 min-h-[2.5rem] leading-tight group-hover:text-gray-700 transition-colors">
                                  {product.item_nm}
                                </h4>
                                
                                {/* 가격 정보 */}
                                <div className="mb-3 space-y-1.5">
                                  {product.sale_price !== null && (
                                    <div className="flex items-baseline gap-1">
                                      <span className="text-xs text-gray-500 font-medium">판매가</span>
                                      <span className={`text-base md:text-lg font-bold ${
                                        activeTab === 'recommended' ? 'text-green-600' : 'text-orange-600'
                                      }`}>
                                        {product.sale_price.toLocaleString()}원
                                      </span>
                                    </div>
                                  )}
                                  {product.cost !== null && (
                                    <div className="text-xs text-gray-500">
                                      원가 {product.cost.toLocaleString()}원
                                    </div>
                                  )}
                                </div>

                                {/* 소분류 및 액션 버튼 */}
                                <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-100">
                                  {product.item_smdv_nm ? (
                                    <span className="text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded-lg border border-gray-200 font-medium">
                                      {product.item_smdv_nm}
                                    </span>
                                  ) : (
                                    <span></span>
                                  )}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setSelectedProduct(product)
                                    }}
                                    title="상세 정보 보기"
                                    className={`p-2 rounded-xl transition-all duration-200 shadow-sm ${
                                      activeTab === 'recommended'
                                        ? 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 hover:shadow-md hover:shadow-green-500/30'
                                        : 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 hover:shadow-md hover:shadow-orange-500/30'
                                    }`}
                                  >
                                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                            </>
                          ) : (
                            // 경량 플레이스홀더 - 스크롤 전까지 표시
                            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100" style={{ minHeight: '300px' }}>
                              <div className="w-16 h-16 md:w-20 md:h-20 bg-gray-200 rounded-xl mb-3 animate-pulse"></div>
                              <div className="w-3/4 h-3 bg-gray-200 rounded-lg mb-2 animate-pulse"></div>
                              <div className="w-1/2 h-3 bg-gray-200 rounded-lg animate-pulse"></div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 스크롤 투 탑 버튼 */}
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="fixed bottom-6 right-6 md:bottom-8 md:right-8 w-12 h-12 md:w-14 md:h-14 bg-gradient-to-br from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 rounded-full flex items-center justify-center shadow-xl hover:shadow-2xl transition-all duration-300 z-40 hover:scale-110 active:scale-95"
            aria-label="맨 위로"
          >
            <svg className="w-6 h-6 md:w-7 md:h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
          </button>

          {/* 추천 근거 모달 */}
          {selectedProduct && (
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-3 md:p-4 animate-in fade-in duration-200"
              onClick={() => setSelectedProduct(null)}
            >
              <div
                className="bg-white max-w-3xl w-full max-h-[90vh] md:max-h-[85vh] overflow-hidden shadow-2xl flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                {/* 모달 헤더 */}
                <div className="sticky top-0 bg-white border-b-2 border-gray-300 px-8 py-6 z-10">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1 pr-4">
                      <div className="flex items-baseline gap-4 mb-3">
                        <div className={`w-1 h-10 ${
                          activeTab === 'recommended' ? 'bg-green-600' : 'bg-orange-600'
                        }`}></div>
                        <div>
                          <h3 className="text-2xl font-bold text-gray-900 leading-tight">
                            {selectedProduct.item_nm}
                          </h3>
                          <p className="text-xs text-gray-500 mt-1 font-medium uppercase tracking-wide">상품 상세 정보</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 ml-6">
                        {selectedProduct.item_mddv_nm && (
                          <span className="text-xs text-gray-700 bg-gray-100 px-3 py-1.5 font-medium border border-gray-300">
                            {selectedProduct.item_mddv_nm}
                          </span>
                        )}
                        {selectedProduct.item_smdv_nm && (
                          <span className={`text-xs px-3 py-1.5 font-medium border ${
                            activeTab === 'recommended' 
                              ? 'text-green-700 bg-green-50 border-green-300' 
                              : 'text-orange-700 bg-orange-50 border-orange-300'
                          }`}>
                            {selectedProduct.item_smdv_nm}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedProduct(null)}
                      className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                      aria-label="닫기"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="px-8 py-8 overflow-y-auto flex-1">

                  {selectedProduct.item_img && (
                    <div className="mb-6 bg-white border border-gray-300">
                      <div className="bg-gray-50 border-b border-gray-300 px-5 py-3">
                        <div className="flex items-baseline gap-4">
                          <div className="w-1 h-5 bg-gray-900"></div>
                          <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wide">상품 이미지</h4>
                        </div>
                      </div>
                      <div className="p-6 relative w-full h-56 md:h-72 overflow-hidden bg-gray-50 flex items-center justify-center border-t border-gray-200">
                        <img
                          src={selectedProduct.item_img}
                          alt={selectedProduct.item_nm}
                          className="w-full h-full object-contain p-4"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                          const parent = e.currentTarget.parentElement
                          if (parent && !parent.querySelector('.image-placeholder')) {
                            const placeholder = document.createElement('div')
                            placeholder.className = 'image-placeholder w-full h-full flex flex-col items-center justify-center text-gray-400'
                            placeholder.innerHTML = `
                              <svg class="w-16 h-16 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <span class="text-sm font-medium">이미지 없음</span>
                            `
                            parent.appendChild(placeholder)
                          }
                        }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-6">
                    <div className="bg-white border border-gray-300">
                      <div className="bg-gray-50 border-b border-gray-300 px-5 py-4">
                        <div className="flex items-baseline gap-4">
                          <div className="w-1 h-6 bg-gray-900"></div>
                          <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide">가격 정보</h4>
                        </div>
                      </div>
                      <div className="p-6 space-y-4">
                        {selectedProduct.sale_price !== null && (
                          <div className="flex items-center justify-between pb-3 border-b border-gray-200">
                            <span className="text-sm text-gray-700 font-semibold">판매가</span>
                            <span className={`text-xl font-bold ${
                              activeTab === 'recommended' ? 'text-green-600' : 'text-orange-600'
                            }`}>
                              {selectedProduct.sale_price.toLocaleString()}원
                            </span>
                          </div>
                        )}
                        {selectedProduct.cost !== null && (
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600 font-medium">원가</span>
                            <span className="text-lg text-gray-700 font-semibold">
                              {selectedProduct.cost.toLocaleString()}원
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="bg-white border border-gray-300">
                      <div className="bg-gray-50 border-b border-gray-300 px-5 py-4">
                        <div className="flex items-baseline gap-4">
                          <div className={`w-1 h-6 ${
                            activeTab === 'recommended' ? 'bg-green-600' : 'bg-orange-600'
                          }`}></div>
                          <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
                            {activeTab === 'recommended' ? '추천 근거' : '부진 근거'}
                          </h4>
                        </div>
                      </div>
                      <div className={`relative ${activeTab === 'recommended' ? 'bg-white border-l-4 border-green-600' : 'bg-white border-l-4 border-orange-600'} p-6 md:p-8`}>
                        {selectedProduct.rec_reason ? (
                          (() => {
                            const recReason = selectedProduct.rec_reason
                            const itemName = selectedProduct.item_nm
                            
                            if (activeTab === 'recommended') {
                              // 추천 상품: R, F, M 값 추출
                              const rMatch = recReason.match(/(\d+\.?\d*)\s*일/)
                              const rValue = rMatch ? rMatch[1] : null
                              
                              const fMatch = recReason.match(/(\d+\.?\d*)\s*회/)
                              const fValue = fMatch ? fMatch[1] : null
                              
                              const mMatch = recReason.match(/([\d,]+)\s*원/)
                              const mValue = mMatch ? mMatch[1].replace(/,/g, '') : null
                              
                              // 결론 부분 추출 (따라서/그래서/권장드립니다 등 포함)
                              const conclusionMatch = recReason.match(/(따라서|그래서|그러므로|결론적으로|종합적으로).+?권장드립니다/)
                              const conclusion = conclusionMatch ? conclusionMatch[0] : null
                              
                              return (
                                <div className="space-y-4">
                                  {/* 인사말 및 상품 소개 */}
                                  <div className="p-4 bg-gradient-to-r from-green-50 to-green-50/50 rounded-lg border border-green-100">
                                    <p className="text-base md:text-lg text-gray-900 leading-relaxed font-medium">
                                      <span className="font-bold text-green-700">{storeName} 점주님!</span>{' '}
                                      <span className="font-semibold">{itemName}</span>은(는) 내 매장과 유사한 매장에서 판매 성과가 우수한 상품입니다.
                                    </p>
                                  </div>
                                  
                                  {/* R, F, M 지표 카드 */}
                                  {(rValue || fValue || mValue) && (
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                      {rValue && (
                                        <div className="bg-white border-2 border-green-200 rounded-lg p-4 text-center">
                                          <div className="text-xs text-gray-500 font-medium mb-2 uppercase tracking-wide">최근 판매 기간</div>
                                          <div className="text-2xl font-bold text-green-600 mb-1">{rValue}</div>
                                          <div className="text-sm text-gray-600">일 내 판매 발생</div>
                                        </div>
                                      )}
                                      {fValue && (
                                        <div className="bg-white border-2 border-green-200 rounded-lg p-4 text-center">
                                          <div className="text-xs text-gray-500 font-medium mb-2 uppercase tracking-wide">한 달 판매 횟수</div>
                                          <div className="text-2xl font-bold text-green-600 mb-1">{parseFloat(fValue).toLocaleString()}</div>
                                          <div className="text-sm text-gray-600">회 이상 판매</div>
                                        </div>
                                      )}
                                      {mValue && (
                                        <div className="bg-white border-2 border-green-200 rounded-lg p-4 text-center">
                                          <div className="text-xs text-gray-500 font-medium mb-2 uppercase tracking-wide">총 매출액</div>
                                          <div className="text-2xl font-bold text-green-600 mb-1">{parseInt(mValue).toLocaleString()}원</div>
                                          <div className="text-sm text-gray-600">한 달 기준</div>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  
                                  {/* 결론/권장사항 */}
                                  {conclusion && (
                                    <div className="p-4 bg-green-600 rounded-lg">
                                      <div className="text-white text-base md:text-lg leading-relaxed font-semibold">
                                        {conclusion}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )
                            } else {
                              // 부진재고: 판매 없음 또는 낮은 판매 실적
                              const isNoSale = recReason.includes('판매가 이루어지지 않았습니다') || 
                                             recReason.includes('판매가 발생하지 않았습니다') ||
                                             recReason.includes('판매가 없었습니다')
                              
                              const rMatch = recReason.match(/(\d+\.?\d*)\s*일\s*내/)
                              const rValue = rMatch ? rMatch[1] : null
                              
                              const fMatch = recReason.match(/(\d+\.?\d*)\s*회\s*판매/)
                              const fValue = fMatch ? fMatch[1] : null
                              
                              const mMatch = recReason.match(/(\d+)\s*원/)
                              const mValue = mMatch ? mMatch[1] : null
                              
                              const conclusionMatch = recReason.match(/(따라서|그래서|그러므로|결론적으로|종합적으로).+?권장드립니다/)
                              const conclusion = conclusionMatch ? conclusionMatch[0] : null
                              
                              return (
                                <div className="space-y-4">
                                  {/* 인사말 및 상품 소개 */}
                                  <div className="p-4 bg-gradient-to-r from-orange-50 to-orange-50/50 rounded-lg border border-orange-100">
                                    <p className="text-base md:text-lg text-gray-900 leading-relaxed font-medium">
                                      <span className="font-bold text-orange-700">{storeName} 점주님!</span>{' '}
                                      <span className="font-semibold">{itemName}</span>은(는) 내 매장에서 판매 실적이 낮은 상품입니다.
                                    </p>
                                  </div>
                                  
                                  {/* 판매 없음 또는 낮은 판매 지표 */}
                                  {isNoSale ? (
                                    <div className="bg-white border-2 border-orange-300 rounded-lg p-6 text-center">
                                      <div className="text-3xl mb-2">⚠️</div>
                                      <div className="text-lg font-bold text-orange-700 mb-2">최근 한 달 판매 없음</div>
                                      <div className="text-sm text-gray-600">판매가 이루어지지 않았습니다</div>
                                    </div>
                                  ) : (
                                    (rValue || fValue || mValue) && (
                                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        {rValue && (
                                          <div className="bg-white border-2 border-orange-200 rounded-lg p-4 text-center">
                                            <div className="text-xs text-gray-500 font-medium mb-2 uppercase tracking-wide">최근 판매 기간</div>
                                            <div className="text-2xl font-bold text-orange-600 mb-1">{rValue}</div>
                                            <div className="text-sm text-gray-600">일 내 판매 발생</div>
                                          </div>
                                        )}
                                        {fValue && (
                                          <div className="bg-white border-2 border-orange-200 rounded-lg p-4 text-center">
                                            <div className="text-xs text-gray-500 font-medium mb-2 uppercase tracking-wide">한 달 판매 횟수</div>
                                            <div className="text-2xl font-bold text-orange-600 mb-1">{parseFloat(fValue).toLocaleString()}</div>
                                            <div className="text-sm text-gray-600">회 판매</div>
                                          </div>
                                        )}
                                        {mValue && (
                                          <div className="bg-white border-2 border-orange-200 rounded-lg p-4 text-center">
                                            <div className="text-xs text-gray-500 font-medium mb-2 uppercase tracking-wide">총 매출액</div>
                                            <div className="text-2xl font-bold text-orange-600 mb-1">{parseInt(mValue).toLocaleString()}원</div>
                                            <div className="text-sm text-gray-600">한 달 기준</div>
                                          </div>
                                        )}
                                      </div>
                                    )
                                  )}
                                  
                                  {/* 결론/권장사항 */}
                                  {conclusion && (
                                    <div className="p-4 bg-orange-600 rounded-lg">
                                      <div className="text-white text-base md:text-lg leading-relaxed font-semibold">
                                        {conclusion}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )
                            }
                          })()
                        ) : (
                          <p className="text-gray-500 text-base">
                            {activeTab === 'recommended' ? '추천 근거가 없습니다.' : '부진 근거가 없습니다.'}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* 순위 정보 */}
                    {(() => {
                      if (activeTab === 'recommended') {
                        // 추천 상품: 기존 rank 사용
                        return selectedProduct.rank !== null ? (
                          <div className="bg-white border border-gray-300">
                            <div className="bg-gray-50 border-b border-gray-300 px-5 py-4">
                              <div className="flex items-baseline gap-4">
                                <div className="w-1 h-6 bg-gray-900"></div>
                                <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide">추천 순위</h4>
                              </div>
                            </div>
                            <div className="p-6">
                              <span className="text-lg font-bold text-green-600">{selectedProduct.rank}위</span>
                            </div>
                          </div>
                        ) : null
                      } else {
                        // 부진재고: 보여지는 순서대로 순위 계산
                        const category = selectedProduct.item_mddv_nm || '기타'
                        const categoryProducts = filteredGroupedProducts[category] || []
                        const displayRank = categoryProducts.findIndex(p => 
                          p.store_code === selectedProduct.store_code && 
                          p.item_cd === selectedProduct.item_cd
                        ) + 1
                        
                        return displayRank > 0 ? (
                          <div className="bg-white border border-gray-300">
                            <div className="bg-gray-50 border-b border-gray-300 px-5 py-4">
                              <div className="flex items-baseline gap-4">
                                <div className="w-1 h-6 bg-gray-900"></div>
                                <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide">발주 제외 권장 순위</h4>
                              </div>
                            </div>
                            <div className="p-6">
                              <span className="text-lg font-bold text-orange-600">{displayRank}위</span>
                            </div>
                          </div>
                        ) : null
                      }
                    })()}
                  </div>
                  
                </div>
                
                {/* 모달 푸터 */}
                <div className="sticky bottom-0 bg-gray-50 border-t-2 border-gray-300 px-8 py-4 flex justify-end">
                  <button
                    onClick={() => setSelectedProduct(null)}
                    className={`px-6 py-2.5 text-white font-medium transition-colors ${
                      activeTab === 'recommended'
                        ? 'bg-green-600 hover:bg-green-700'
                        : 'bg-orange-600 hover:bg-orange-700'
                    }`}
                  >
                    확인
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}

