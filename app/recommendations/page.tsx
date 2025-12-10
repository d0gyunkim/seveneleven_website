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
  const urlTab = searchParams.get('tab') || 'recommended'
  
  const [recommendedProducts, setRecommendedProducts] = useState<Product[]>([])
  const [excludedProducts, setExcludedProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [storeName, setStoreName] = useState<string>('')
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const activeTab = (urlTab === 'excluded' ? 'excluded' : 'recommended') as 'recommended' | 'excluded'
  const [visibleItems, setVisibleItems] = useState<Set<string>>(new Set())
  const [selectedLargeCategory, setSelectedLargeCategory] = useState<string | null>(null)
  const [selectedMiddleCategory, setSelectedMiddleCategory] = useState<string | null>(null)

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

  // 선택된 대분류와 중분류에 따라 필터링된 중분류 그룹
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
        // 중분류가 선택되었으면 해당 중분류만 필터링
        if (selectedMiddleCategory && category !== selectedMiddleCategory) {
          return
        }
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
  }, [selectedLargeCategory, selectedMiddleCategory, activeTab, recommendedProducts, excludedProducts, recommendedCategoryOrder])

  // 선택된 대분류에 따른 중분류 목록 추출
  const middleCategories = useMemo(() => {
    if (!selectedLargeCategory) return []
    
    const currentProducts = activeTab === 'recommended' ? recommendedProducts : excludedProducts
    const categories = new Set<string>()
    
    currentProducts.forEach((product) => {
      if (product.item_lrdv_nm === selectedLargeCategory && product.item_mddv_nm) {
        categories.add(product.item_mddv_nm)
      }
    })
    
    // 추천 상품의 중분류 순서 기준으로 정렬
    const recommendedOrder = recommendedCategoryOrder.get(selectedLargeCategory) || []
    const sortedCategories = Array.from(categories).sort((a, b) => {
      const indexA = recommendedOrder.indexOf(a)
      const indexB = recommendedOrder.indexOf(b)
      
      if (indexA === -1 && indexB === -1) return a.localeCompare(b)
      if (indexA === -1) return 1
      if (indexB === -1) return -1
      return indexA - indexB
    })
    
    return sortedCategories
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
      setSelectedMiddleCategory(null) // 중분류도 초기화
    } else {
      setSelectedLargeCategory(null)
      setSelectedMiddleCategory(null)
    }
  }, [activeTab, recommendedProducts, excludedProducts])

  // 대분류 변경 시 중분류 초기화
  useEffect(() => {
    setSelectedMiddleCategory(null)
  }, [selectedLargeCategory])

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
      <div className="bg-gradient-to-br from-gray-50 via-white to-gray-50">
        <div className="w-full">
          {/* 고정 헤더 섹션 */}
          <div className="sticky top-0 z-20 pt-6 md:pt-8 pb-4 md:pb-6 bg-gradient-to-br from-gray-50 via-white to-gray-50 shadow-sm px-4 md:px-6 lg:px-8">
            {/* 안내 문구 - 탭별로 표시 (탭 박스 위에 배치) */}
            {activeTab === 'recommended' && (
              <div className="bg-white p-8 md:p-12 mb-6 md:mb-8 text-center">
                <p className="text-2xl md:text-3xl lg:text-4xl text-slate-900 leading-relaxed">
                  <span className="text-emerald-600">유사 매장의</span> 판매 데이터를 수집·분석하여 선별한 추천 상품입니다.
                  <br />
                  <br />
                  내 매장 미취급 상품 중 유사 매장들에서 판매 성과가 우수한 상품들을 선별하여 추천하고 있습니다.
                </p>
              </div>
            )}

            {activeTab === 'excluded' && (
              <div className="bg-white p-8 md:p-12 mb-6 md:mb-8 text-center">
                <p className="text-2xl md:text-3xl lg:text-4xl text-slate-900 leading-relaxed">
                  <span className="font-bold">발주 제외 권장 상품</span>을 확인하여 매장 운영을 더욱 효율적으로 관리하세요.
                </p>
              </div>
            )}

          </div>

          {/* 메인 콘텐츠 영역 - CU 스타일 레이아웃 */}
          <div className="flex gap-6 pb-6 px-4 md:px-6 lg:px-8">
            {/* 왼쪽 사이드바 - 대분류 카테고리 */}
            {largeCategories.length > 0 && (
              <aside className="hidden md:block w-56 flex-shrink-0">
                <div className="bg-white rounded-lg p-4 sticky top-24">
                  <h3 className="text-base font-bold text-slate-900 mb-4 uppercase tracking-wide">대분류 카테고리</h3>
                  <nav className="space-y-1">
                    {largeCategories.map((category) => (
                      <button
                        key={category}
                        onClick={() => setSelectedLargeCategory(category)}
                        className={`w-full text-left px-4 py-3 text-base font-medium rounded-md transition-colors flex items-center justify-between ${
                          selectedLargeCategory === category
                            ? 'bg-emerald-100 text-slate-900'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span>{category}</span>
                        {selectedLargeCategory === category && (
                          <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        )}
                      </button>
                    ))}
                  </nav>
                </div>
              </aside>
            )}

            {/* 메인 콘텐츠 영역 */}
            <div className="flex-1 min-w-0">
              {/* 모바일 대분류 선택 */}
              {largeCategories.length > 0 && (
                <div className="md:hidden mb-4">
                  <select
                    value={selectedLargeCategory || ''}
                    onChange={(e) => setSelectedLargeCategory(e.target.value || null)}
                    className="w-full px-4 py-2 text-sm font-medium border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">대분류 선택</option>
                    {largeCategories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* 중분류 필터 - 가로 배치 */}
              {selectedLargeCategory && middleCategories.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => setSelectedMiddleCategory(null)}
                      className={`px-5 py-2.5 text-base font-medium rounded-md transition-colors whitespace-nowrap ${
                        selectedMiddleCategory === null
                          ? activeTab === 'recommended'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-amber-600 text-white'
                          : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      전체
                    </button>
                    {middleCategories.map((category) => (
                      <button
                        key={category}
                        onClick={() => setSelectedMiddleCategory(category)}
                        className={`px-5 py-2.5 text-base font-medium rounded-md transition-colors whitespace-nowrap ${
                          selectedMiddleCategory === category
                            ? activeTab === 'recommended'
                              ? 'bg-emerald-600 text-white'
                              : 'bg-amber-600 text-white'
                            : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        {category}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 중분류별 상품 그룹 */}
          {Object.keys(filteredGroupedProducts).length === 0 ? (
            <div className="text-center py-16 bg-white border border-slate-200 rounded-lg">
              <div className="w-14 h-14 bg-gradient-to-br from-slate-200 to-slate-300 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-7 h-7 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
              </div>
              <h3 className="text-base md:text-lg font-extrabold text-slate-900 mb-1.5">데이터 없음</h3>
              <p className="text-xs md:text-sm text-slate-600 font-medium">
                {activeTab === 'recommended' ? '해당 카테고리의 추천 상품 데이터가 준비되지 않았습니다.' : '해당 카테고리의 부진재고 데이터가 준비되지 않았습니다.'}
              </p>
            </div>
          ) : (
            <div className="space-y-8 md:space-y-10">
              {Object.entries(filteredGroupedProducts).map(([category, products]) => (
                <div key={category} className="space-y-4">
                  {/* 카테고리 제목 - 중분류가 선택되지 않았을 때만 표시 */}
                  {!selectedMiddleCategory && (
                    <div className="flex items-center gap-2">
                      <div className={`w-1 h-6 rounded-full ${
                        activeTab === 'recommended' ? 'bg-emerald-500' : 'bg-amber-500'
                      }`}></div>
                      <h3 className="text-base md:text-lg font-bold text-slate-900">{category}</h3>
                    </div>
                  )}
                  
                  {/* 상품 그리드 */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-5">
                    {products.map((product) => {
                      const itemId = `${product.store_code}-${product.item_cd}`
                      const isVisible = visibleItems.has(itemId)
                      
                      return (
                        <div
                          key={itemId}
                          ref={(el) => setItemRef(itemId, el)}
                          data-item-id={itemId}
                          onClick={() => setSelectedProduct(product)}
                          className="group bg-white rounded-xl overflow-hidden cursor-pointer flex flex-col relative transition-all duration-300 hover:shadow-md"
                        >
                          {isVisible ? (
                            <>
                              {/* 순위 배지 */}
                              {product.rank !== null && product.rank <= 3 && (
                                <div className={`absolute top-3 left-3 z-10 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white shadow-md ${
                                  product.rank === 1 ? 'bg-gradient-to-br from-yellow-400 to-yellow-600' :
                                  product.rank === 2 ? 'bg-gradient-to-br from-gray-300 to-gray-500' :
                                  'bg-gradient-to-br from-orange-400 to-orange-600'
                                }`}>
                                  {product.rank}
                                </div>
                              )}

                              {/* 상품 이미지 */}
                              <div className="relative aspect-square bg-white overflow-hidden flex items-center justify-center">
                                {product.item_img ? (
                                  <img
                                    src={product.item_img}
                                    alt={product.item_nm}
                                    className="w-full h-full object-contain p-4 md:p-6 transition-transform duration-300 group-hover:scale-105"
                                    loading="lazy"
                                    onError={(e) => {
                                      e.currentTarget.style.display = 'none'
                                      const parent = e.currentTarget.parentElement
                                      if (parent && !parent.querySelector('.image-placeholder')) {
                                        const placeholder = document.createElement('div')
                                        placeholder.className = 'image-placeholder w-full h-full flex flex-col items-center justify-center text-gray-300'
                                        placeholder.innerHTML = `
                                          <svg class="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                          </svg>
                                          <span class="text-xs text-gray-400">이미지 없음</span>
                                        `
                                        parent.appendChild(placeholder)
                                      }
                                    }}
                                  />
                                ) : (
                                  <div className="w-full h-full flex flex-col items-center justify-center text-gray-300">
                                    <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    <span className="text-xs text-gray-400">이미지 없음</span>
                                  </div>
                                )}
                              </div>

                              {/* 상품 정보 */}
                              <div className="px-4 pb-4 pt-2 flex flex-col space-y-2">
                                <h4 className="text-sm font-medium text-slate-900 line-clamp-2 leading-snug">
                                  {product.item_nm}
                                </h4>
                                
                                {/* 가격 정보 */}
                                {product.sale_price !== null && (
                                  <div className="pt-1">
                                    <span className="text-lg font-bold text-slate-900">
                                      {product.sale_price.toLocaleString()} 원
                                    </span>
                                  </div>
                                )}
                              </div>
                            </>
                          ) : (
                            // 경량 플레이스홀더 - 스크롤 전까지 표시
                            <div className="w-full aspect-square flex flex-col items-center justify-center bg-white">
                              <div className="w-12 h-12 md:w-16 md:h-16 bg-gray-200 rounded-lg mb-2 animate-pulse"></div>
                              <div className="w-3/4 h-2.5 bg-gray-200 rounded-lg mb-1.5 animate-pulse"></div>
                              <div className="w-1/2 h-2.5 bg-gray-200 rounded-lg animate-pulse"></div>
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
            </div>
          </div>
        </div>
      </div>

      {/* 스크롤 투 탑 버튼 */}
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className="fixed bottom-6 right-6 md:bottom-8 md:right-8 w-12 h-12 md:w-14 md:h-14 bg-emerald-600 hover:bg-emerald-700 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-300 z-40 hover:scale-110 active:scale-95"
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
                className="bg-white max-w-3xl w-full max-h-[85vh] md:max-h-[80vh] overflow-hidden shadow-xl flex flex-col rounded-lg"
                onClick={(e) => e.stopPropagation()}
              >
                {/* 모달 헤더 */}
                <div className="sticky top-0 bg-white px-6 py-4 z-10">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 pr-4">
                      <h3 className="text-lg md:text-xl font-bold text-slate-900 leading-tight mb-1">
                        {selectedProduct.item_nm}
                      </h3>
                      <p className="text-xs text-slate-500 mb-3">상품 상세 정보</p>
                      <div className="flex flex-wrap gap-2">
                        {selectedProduct.item_mddv_nm && (
                          <span className="text-xs text-slate-600 bg-slate-50 px-2.5 py-1 font-medium rounded-md">
                            {selectedProduct.item_mddv_nm}
                          </span>
                        )}
                        {selectedProduct.item_smdv_nm && (
                          <span className={`text-xs px-2.5 py-1 font-medium rounded-md ${
                            activeTab === 'recommended' 
                              ? 'text-emerald-700 bg-emerald-50' 
                              : 'text-amber-700 bg-amber-50'
                          }`}>
                            {selectedProduct.item_smdv_nm}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedProduct(null)}
                      className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors rounded-lg"
                      aria-label="닫기"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="px-6 py-4 overflow-y-auto flex-1" style={{ maxHeight: 'calc(85vh - 140px)' }}>
                  {/* 상단: 이미지(왼쪽) + 가격 정보(오른쪽) */}
                  <div className="flex flex-col md:flex-row gap-6 mb-6">
                    {/* 이미지 영역 - 왼쪽 */}
                    {selectedProduct.item_img && (
                      <div className="flex-shrink-0 w-full md:w-1/2">
                        {selectedProduct.rank !== null && selectedProduct.rank <= 10 && (
                          <h4 className="text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wider">
                            추천 순위: {selectedProduct.rank}위
                          </h4>
                        )}
                        <div className="relative w-full h-64 md:h-80 overflow-hidden bg-slate-50 rounded-lg flex items-center justify-center">
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
                                  <svg class="w-10 h-10 mb-2 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                  <span class="text-xs text-slate-400">이미지 없음</span>
                                `
                                parent.appendChild(placeholder)
                              }
                            }}
                          />
                        </div>
                      </div>
                    )}

                    {/* 가격 정보 영역 - 오른쪽 */}
                    <div className="flex-1">
                      <h4 className="text-xs font-semibold text-slate-700 mb-3 uppercase tracking-wider">가격 정보</h4>
                      <div className="space-y-3">
                        {selectedProduct.sale_price !== null && (
                          <div className="flex items-center justify-between pb-3">
                            <span className="text-sm text-slate-600 font-medium">판매가</span>
                            <span className={`text-lg font-bold ${
                              activeTab === 'recommended' ? 'text-emerald-600' : 'text-amber-600'
                            }`}>
                              {selectedProduct.sale_price.toLocaleString()}원
                            </span>
                          </div>
                        )}
                        {selectedProduct.cost !== null && (
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-slate-600 font-medium">원가</span>
                            <span className="text-base text-slate-800 font-semibold">
                              {selectedProduct.cost.toLocaleString()}원
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 하단: 추천 근거 및 순위 정보 */}
                  <div className="space-y-4">

                    <div>
                      <h4 className="text-xs font-semibold text-slate-700 mb-3 uppercase tracking-wider">
                        {activeTab === 'recommended' ? '추천 근거' : '부진 근거'}
                      </h4>
                      <div className="space-y-3">
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
                                  <div className="p-3 bg-emerald-50 rounded-lg">
                                    <p className="text-sm text-slate-900 leading-relaxed">
                                      <span className="font-bold text-emerald-700">{storeName} 점주님!</span>{' '}
                                      <span className="font-semibold">{itemName}</span>은(는) 내 매장과 유사한 매장에서 판매 성과가 우수한 상품입니다.
                                    </p>
                                  </div>
                                  
                                  {/* R, F, M 지표 카드 */}
                                  {(rValue || fValue || mValue) && (
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                      {rValue && (
                                        <div className="bg-slate-50 rounded-lg p-3 text-center border border-slate-100">
                                          <div className="text-xs text-slate-500 font-medium mb-2">최근 판매 기간</div>
                                          <div className="text-xl font-bold text-emerald-600 mb-1">{rValue}</div>
                                          <div className="text-xs text-slate-500">일 내 판매 발생</div>
                                        </div>
                                      )}
                                      {fValue && (
                                        <div className="bg-slate-50 rounded-lg p-3 text-center border border-slate-100">
                                          <div className="text-xs text-slate-500 font-medium mb-2">한 달 판매 횟수</div>
                                          <div className="text-xl font-bold text-emerald-600 mb-1">{parseFloat(fValue).toLocaleString()}</div>
                                          <div className="text-xs text-slate-500">회 이상 판매</div>
                                        </div>
                                      )}
                                      {mValue && (
                                        <div className="bg-slate-50 rounded-lg p-3 text-center border border-slate-100">
                                          <div className="text-xs text-slate-500 font-medium mb-2">총 매출액</div>
                                          <div className="text-xl font-bold text-emerald-600 mb-1">{parseInt(mValue).toLocaleString()}원</div>
                                          <div className="text-xs text-slate-500">한 달 기준</div>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  
                                  {/* 결론/권장사항 */}
                                  {conclusion && (
                                    <div className="p-3 bg-emerald-600 rounded-lg">
                                      <div className="text-white text-sm leading-relaxed font-medium">
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
                                  <div className="p-3 bg-amber-50 rounded-lg">
                                    <p className="text-sm text-slate-900 leading-relaxed">
                                      <span className="font-bold text-amber-700">{storeName} 점주님!</span>{' '}
                                      <span className="font-semibold">{itemName}</span>은(는) 내 매장에서 판매 실적이 낮은 상품입니다.
                                    </p>
                                  </div>
                                  
                                  {/* 판매 없음 또는 낮은 판매 지표 */}
                                  {isNoSale ? (
                                    <div className="bg-slate-50 border border-amber-200 rounded-lg p-4 text-center">
                                      <div className="text-2xl mb-2">⚠️</div>
                                      <div className="text-sm font-bold text-amber-700 mb-1">최근 한 달 판매 없음</div>
                                      <div className="text-xs text-slate-600">판매가 이루어지지 않았습니다</div>
                                    </div>
                                  ) : (
                                    (rValue || fValue || mValue) && (
                                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                        {rValue && (
                                          <div className="bg-slate-50 rounded-lg p-3 text-center border border-slate-100">
                                            <div className="text-xs text-slate-500 font-medium mb-2">최근 판매 기간</div>
                                            <div className="text-xl font-bold text-amber-600 mb-1">{rValue}</div>
                                            <div className="text-xs text-slate-500">일 내 판매 발생</div>
                                          </div>
                                        )}
                                        {fValue && (
                                          <div className="bg-slate-50 rounded-lg p-3 text-center border border-slate-100">
                                            <div className="text-xs text-slate-500 font-medium mb-2">한 달 판매 횟수</div>
                                            <div className="text-xl font-bold text-amber-600 mb-1">{parseFloat(fValue).toLocaleString()}</div>
                                            <div className="text-xs text-slate-500">회 판매</div>
                                          </div>
                                        )}
                                        {mValue && (
                                          <div className="bg-slate-50 rounded-lg p-3 text-center border border-slate-100">
                                            <div className="text-xs text-slate-500 font-medium mb-2">총 매출액</div>
                                            <div className="text-xl font-bold text-amber-600 mb-1">{parseInt(mValue).toLocaleString()}원</div>
                                            <div className="text-xs text-slate-500">한 달 기준</div>
                                          </div>
                                        )}
                                      </div>
                                    )
                                  )}
                                  
                                  {/* 결론/권장사항 */}
                                  {conclusion && (
                                    <div className="p-3 bg-amber-600 rounded-lg">
                                      <div className="text-white text-sm leading-relaxed font-medium">
                                        {conclusion}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )
                            }
                          })()
                        ) : (
                          <p className="text-slate-500 text-sm">
                            {activeTab === 'recommended' ? '추천 근거가 없습니다.' : '부진 근거가 없습니다.'}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  
                </div>
                
                {/* 모달 푸터 */}
                <div className="sticky bottom-0 bg-white px-6 py-4 flex justify-end">
                  <button
                    onClick={() => setSelectedProduct(null)}
                    className={`px-6 py-2.5 text-sm text-white font-semibold transition-colors rounded-lg ${
                      activeTab === 'recommended'
                        ? 'bg-emerald-600 hover:bg-emerald-700'
                        : 'bg-amber-600 hover:bg-amber-700'
                    }`}
                  >
                    확인
                  </button>
                </div>
              </div>
            </div>
          )}
    </Layout>
  )
}

