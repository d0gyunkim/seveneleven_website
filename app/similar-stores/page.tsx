'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Layout from '@/components/Layout'
import KakaoMap from '@/components/KakaoMap'
import { supabase } from '@/lib/supabase'
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LineChart, Line, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts'

interface SimilarStore {
  store_code: string
  store_nm: string
  rank: number
  address?: string
  영업시간?: string
  매장면적?: string
  전화번호?: string
  latitude?: number
  longitude?: number
  similarity_score?: number // 유사도 점수 (0-100)
  similarity_reasons?: string[] // 유사도 근거 (주요 2-3개)
}

interface StoreDetail {
  store_code: string
  store_nm: string
  월기준: string
  과자?: any
  냉장?: any
  맥주?: any
  면?: any
  미반?: any
  빵?: any
  음료?: any
  판매패턴?: any
  시간대패턴?: any
  주중주말패턴?: any
}

type CategoryType = '과자' | '냉장' | '맥주' | '면' | '미반' | '빵' | '음료'

interface ProductInfo {
  item_nm: string
  item_img: string | null
  item_lrdv_nm: string | null
  item_mddv_nm: string | null
  item_smdv_nm: string | null
  cpm_amt: number | null // 원가
  slem_amt: number | null // 판매가
}

export default function SimilarStoresPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const urlStoreCode = searchParams.get('storeCode') || ''
  
  const [similarStores, setSimilarStores] = useState<SimilarStore[]>([])
  const [currentStoreName, setCurrentStoreName] = useState<string>('')
  const [currentStoreInfo, setCurrentStoreInfo] = useState<SimilarStore | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedStore, setSelectedStore] = useState<StoreDetail | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<CategoryType>('과자')
  const [selectedMiddleCategory, setSelectedMiddleCategory] = useState<string | null>(null) // 선택된 중분류
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [showStoreDetailModal, setShowStoreDetailModal] = useState(false)
  const [storeDetailsByMonth, setStoreDetailsByMonth] = useState<Record<string, StoreDetail>>({})
  const [selectedMonth, setSelectedMonth] = useState<string>('')
  const [availableMonths, setAvailableMonths] = useState<string[]>([])
  const [timePatternTab, setTimePatternTab] = useState<'주중' | '주말'>('주중')
  const [averageModalTimeTab, setAverageModalTimeTab] = useState<'주중' | '주말'>('주중')
  const [storeDetailTab, setStoreDetailTab] = useState<'근거' | '인기상품'>('근거')
  // 현재 매장의 월별 데이터와 선택된 월
  const [currentStoreDataByMonth, setCurrentStoreDataByMonth] = useState<Record<string, any>>({})
  const [currentStoreAvailableMonths, setCurrentStoreAvailableMonths] = useState<string[]>([])
  const [currentSelectedMonth, setCurrentSelectedMonth] = useState<string>('')
  const [openStoreCode, setOpenStoreCode] = useState<string | null>(null) // 지도에서 열 매장 코드
  const [selectedStoreCode, setSelectedStoreCode] = useState<string | null>(null) // 선택된 매장 코드
  const [selectedProduct, setSelectedProduct] = useState<ProductInfo | null>(null) // 선택된 상품 정보
  const [productInfoMap, setProductInfoMap] = useState<Map<string, ProductInfo>>(new Map()) // 상품 정보 캐시
  const [currentStorePatterns, setCurrentStorePatterns] = useState<{
    판매패턴?: any
    시간대패턴?: any
    주중주말패턴?: any
  } | null>(null) // 현재 매장의 패턴 데이터
  const [selectedPatternType, setSelectedPatternType] = useState<'판매패턴' | '시간대패턴' | '주중주말패턴' | null>(null) // 선택된 패턴 타입
  const [similarStoresPatterns, setSimilarStoresPatterns] = useState<Array<{
    store_code: string
    판매패턴?: any
    시간대패턴?: any
    주중주말패턴?: any
    판매패턴_유사도근거?: string
    주중_시간대패턴_유사도근거?: string
    주말_시간대패턴_유사도근거?: string
    주중주말_유사도근거?: string
  }>>([]) // 유사매장들의 패턴 데이터
  const [averageComparisonTab, setAverageComparisonTab] = useState<'주중' | '주말'>('주중') // 평균 비교 섹션의 시간대 탭
  const [showCriteriaModal, setShowCriteriaModal] = useState(false) // 유사 매장 선정 기준 모달
  const [isMobile, setIsMobile] = useState(false) // 모바일 감지
  const [visibleItems, setVisibleItems] = useState<Set<string>>(new Set()) // 보이는 아이템 추적
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map()) // 아이템 refs
  const observerRef = useRef<IntersectionObserver | null>(null) // IntersectionObserver ref

  // 모바일 감지
  useEffect(() => {
    const checkMobile = () => {
      const isMobileDevice = window.innerWidth < 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      setIsMobile(isMobileDevice)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

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
      router.replace(`/similar-stores?storeCode=${encodeURIComponent(storeCode)}`)
      return
    }

    fetchSimilarStores(storeCode)
  }, [urlStoreCode, router])

  const fetchSimilarStores = async (code: string) => {
    setLoading(true)
    setError(null)

    try {
      // 매장마스터 테이블에서 현재 매장 정보 조회
      // store_code는 text 타입이므로 문자열로 조회 (숫자 변환도 시도)
      const codeVariants = [code.toString(), code, parseInt(code).toString()]
      
      let foundStore: any = null
      let lastError: any = null

      console.log('조회 시도 중인 store_code 변형:', codeVariants)

      for (const codeVariant of codeVariants) {
        // 같은 store_code가 여러 월에 있을 수 있으므로 모든 데이터를 가져옴
        const { data: storeData, error: storeError } = await supabase
          .from('매장마스터')
          .select('*')
          .eq('store_code', String(codeVariant))

        if (storeError) {
          console.log(`매장마스터 테이블 (storecode: ${codeVariant}) 조회 실패:`, storeError.message)
          if (!lastError) lastError = storeError
          continue
        }

        if (storeData && storeData.length > 0) {
          // 월별로 데이터 그룹화
          const dataByMonth: Record<string, any> = {}
          const months: string[] = []
          
          storeData.forEach((store: any) => {
            const month = store.월기준 || ''
            if (month && !months.includes(month)) {
              months.push(month)
            }
            dataByMonth[month] = store
          })

          // 월 정렬 (9월, 8월 순서)
          months.sort((a, b) => {
            const monthA = parseInt(a.replace('월', '')) || 0
            const monthB = parseInt(b.replace('월', '')) || 0
            return monthB - monthA // 내림차순
          })

          // 월별 데이터 저장
          setCurrentStoreDataByMonth(dataByMonth)
          setCurrentStoreAvailableMonths(months)
          
          // 가장 최신 월을 기본으로 선택
          if (months.length > 0) {
            const firstMonth = months[0]
            foundStore = dataByMonth[firstMonth]
            setCurrentSelectedMonth(firstMonth)
          }
          
          break
        } else {
          console.log(`매장마스터 테이블 (storecode: ${codeVariant})에서 데이터 없음`)
        }
      }

      if (!foundStore) {
        console.error('마지막 오류:', lastError)
        setError(`매장 코드 ${code}에 해당하는 데이터를 찾을 수 없습니다.`)
        setLoading(false)
        return
      }

      // 매장명 설정
      const storeName = foundStore.store_nm || ''
      setCurrentStoreName(storeName)
      
      // 현재 매장 정보 저장 (지도 표시용)
      const foundStoreData = foundStore as any
      const latRaw = foundStoreData['위도'] || foundStoreData.latitude
      const lngRaw = foundStoreData['경도'] || foundStoreData.longitude
      
      let latitude: number | undefined
      let longitude: number | undefined
      
      if (latRaw) {
        const latNum = typeof latRaw === 'number' ? latRaw : parseFloat(String(latRaw))
        latitude = isNaN(latNum) ? undefined : latNum
      }
      
      if (lngRaw) {
        const lngNum = typeof lngRaw === 'number' ? lngRaw : parseFloat(String(lngRaw))
        longitude = isNaN(lngNum) ? undefined : lngNum
      }
      
      setCurrentStoreInfo({
        store_code: String(foundStoreData.store_code),
        store_nm: storeName,
        rank: 0, // 현재 매장은 순위 0으로 표시
        address: foundStoreData['주소'] || foundStoreData.address || undefined,
        영업시간: foundStoreData['영업시간'] || foundStoreData.영업시간 || undefined,
        매장면적: foundStoreData['매장면적'] || foundStoreData.매장면적 || undefined,
        전화번호: foundStoreData['전화번호'] || foundStoreData.전화번호 || undefined,
        latitude,
        longitude,
      })

      // 현재 매장의 패턴 데이터 저장
      setCurrentStorePatterns({
        판매패턴: foundStoreData['판매패턴'] || foundStoreData.판매패턴,
        시간대패턴: foundStoreData['시간대패턴'] || foundStoreData.시간대패턴,
        주중주말패턴: foundStoreData['주중주말패턴'] || foundStoreData.주중주말패턴,
      })

      // 가장 최신 월의 유사매장 목록 가져오기 (초기 로드)
      if (currentStoreAvailableMonths.length > 0) {
        const firstMonth = currentStoreAvailableMonths[0]
        setCurrentSelectedMonth(firstMonth)
        await loadSimilarStoresForMonth(firstMonth)
      }

    } catch (err: any) {
      console.error('데이터 조회 중 오류:', err)
      setError(`데이터를 불러오는 중 오류가 발생했습니다: ${err.message || '알 수 없는 오류'}`)
    } finally {
      setLoading(false)
    }
  }

  const loadSimilarStoresForMonth = async (month: string) => {
    if (!month || !currentStoreDataByMonth[month]) {
      return
    }

    const storeData = currentStoreDataByMonth[month]
    
    // 유사매장_리스트 컬럼에서 유사 매장 코드 배열 가져오기
    const similarStoreCodes = storeData.유사매장_리스트 
      || storeData['유사매장_리스트']
      || []
    
    console.log(`${month} 유사매장_리스트 값:`, similarStoreCodes)
    
    // 배열이 아니거나 비어있으면 에러
    if (!Array.isArray(similarStoreCodes) || similarStoreCodes.length === 0) {
      console.error(`${month} 유사매장_리스트가 비어있거나 배열이 아님`)
      setSimilarStores([])
      return
    }
    
    // 배열의 각 요소를 문자열로 변환
    const normalizedCodes = similarStoreCodes.map(code => String(code))
    console.log(`${month} 정규화된 유사 매장 코드:`, normalizedCodes)

    // 각 유사 매장 코드에 대해 매장 정보 조회
    const similarStoresData: SimilarStore[] = []
    
    for (let i = 0; i < normalizedCodes.length; i++) {
      const similarCode = normalizedCodes[i]
      
      const { data: similarStoreData, error: similarStoreError } = await supabase
        .from('매장마스터')
        .select('*')
        .eq('store_code', similarCode)
        .limit(1)

      if (similarStoreError) {
        console.log(`유사 매장 ${similarCode} 조회 실패:`, similarStoreError.message)
        continue
      }

      if (similarStoreData && similarStoreData.length > 0) {
        const similarStore = similarStoreData[0] as any
        const similarStoreNm = similarStore.store_nm || ''
        
        // 위도/경도 숫자 변환 (text 타입이므로 안전하게 변환)
        const latRaw = similarStore['위도'] || similarStore.latitude
        const lngRaw = similarStore['경도'] || similarStore.longitude
        
        let latitude: number | undefined
        let longitude: number | undefined
        
        if (latRaw) {
          const latNum = typeof latRaw === 'number' ? latRaw : parseFloat(String(latRaw))
          latitude = isNaN(latNum) ? undefined : latNum
        }
        
        if (lngRaw) {
          const lngNum = typeof lngRaw === 'number' ? lngRaw : parseFloat(String(lngRaw))
          longitude = isNaN(lngNum) ? undefined : lngNum
        }
        
        // 유사도 점수 계산 (임시: 순위 기반 점수, 실제로는 백엔드에서 제공되어야 함)
        // 순위가 높을수록 유사도가 높으므로 역순으로 점수 계산
        const similarityScore = Math.max(85, 100 - (i * 2)) // 1위: 100점, 2위: 98점, ...
        
        // 유사도 근거 생성 (실제로는 백엔드에서 제공되어야 함)
        const similarityReasons = [
          '판매 패턴 유사도 높음',
          '시간대별 고객 유입 패턴 일치',
          '주중/주말 매출 비율 유사'
        ]

        similarStoresData.push({
          store_code: String(similarStore.store_code),
          store_nm: similarStoreNm,
          rank: i + 1, // 순위는 1부터 시작
          address: similarStore['주소'] || similarStore.address || undefined,
          영업시간: similarStore['영업시간'] || similarStore.영업시간 || undefined,
          매장면적: similarStore['매장면적'] || similarStore.매장면적 || undefined,
          전화번호: similarStore['전화번호'] || similarStore.전화번호 || undefined,
          latitude,
          longitude,
          similarity_score: similarityScore,
          similarity_reasons: similarityReasons,
        })
      }
    }

    console.log(`${month} 최종 유사 매장 개수:`, similarStoresData.length)
    setSimilarStores(similarStoresData)
  }

  // 현재 매장의 월 변경 핸들러
  const handleCurrentMonthChange = (month: string) => {
    setCurrentSelectedMonth(month)
    loadSimilarStoresForMonth(month)
  }

  // currentSelectedMonth가 변경되면 유사매장 목록 다시 로드
  useEffect(() => {
    if (currentSelectedMonth && Object.keys(currentStoreDataByMonth).length > 0) {
      loadSimilarStoresForMonth(currentSelectedMonth)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSelectedMonth])

  // 유사매장들의 패턴 데이터 가져오기
  useEffect(() => {
    const fetchSimilarStoresPatterns = async () => {
      if (similarStores.length === 0) {
        setSimilarStoresPatterns([])
        return
      }

      const patterns: Array<{
        store_code: string
        판매패턴?: any
        시간대패턴?: any
        주중주말패턴?: any
        판매패턴_유사도근거?: string
        주중_시간대패턴_유사도근거?: string
        주말_시간대패턴_유사도근거?: string
        주중주말_유사도근거?: string
      }> = []

      for (const store of similarStores) {
        try {
          const { data: storeData, error } = await supabase
            .from('매장마스터')
            .select('*')
            .eq('store_code', store.store_code)
            .eq('월기준', currentSelectedMonth)
            .limit(1)
            .single()

          if (!error && storeData) {
            const data = storeData as any
            patterns.push({
              store_code: store.store_code,
              판매패턴: data['판매패턴'] || data.판매패턴,
              시간대패턴: data['시간대패턴'] || data.시간대패턴,
              주중주말패턴: data['주중주말패턴'] || data.주중주말패턴,
              판매패턴_유사도근거: data['판매패턴_유사도근거'] || data.판매패턴_유사도근거,
              주중_시간대패턴_유사도근거: data['주중_시간대패턴_유사도근거'] || data.주중_시간대패턴_유사도근거,
              주말_시간대패턴_유사도근거: data['주말_시간대패턴_유사도근거'] || data.주말_시간대패턴_유사도근거,
              주중주말_유사도근거: data['주중주말_유사도근거'] || data.주중주말_유사도근거,
            })
          }
        } catch (err) {
          console.error(`유사매장 ${store.store_code} 패턴 데이터 조회 실패:`, err)
        }
      }

      setSimilarStoresPatterns(patterns)
    }

    if (similarStores.length > 0 && currentSelectedMonth) {
      fetchSimilarStoresPatterns()
    }
  }, [similarStores, currentSelectedMonth])

  const fetchStoreDetail = async (storeCode: string) => {
    setLoadingDetail(true)
    try {
      const { data: storeData, error: storeError } = await supabase
        .from('매장마스터')
        .select('store_code, store_nm, 월기준, 과자, 냉장, 맥주, 면, 미반, 빵, 음료, 판매패턴, 시간대패턴, 주중주말패턴')
        .eq('store_code', storeCode)

      if (storeError) {
        console.error('매장 상세 정보 조회 실패:', storeError)
        return
      }

      if (storeData && storeData.length > 0) {
        // 월별로 데이터 그룹화
        const detailsByMonth: Record<string, StoreDetail> = {}
        const months: string[] = []
        
        console.log('매장 상세 데이터:', storeData)
        
        storeData.forEach((store: any) => {
          const month = store.월기준 || ''
          console.log('월기준 값:', month, '전체 데이터:', store)
          if (month) {
            if (!months.includes(month)) {
              months.push(month)
            }
            // 같은 월이 여러 개 있어도 마지막 것을 사용 (일반적으로는 하나만 있어야 함)
            detailsByMonth[month] = store as unknown as StoreDetail
          }
        })

        // 월 정렬 (9월, 8월, 7월... 순서)
        months.sort((a, b) => {
          const monthA = parseInt(a.replace('월', '')) || 0
          const monthB = parseInt(b.replace('월', '')) || 0
          return monthB - monthA // 내림차순
        })

        console.log('정렬된 월 목록:', months)
        console.log('월별 데이터:', detailsByMonth)

        setStoreDetailsByMonth(detailsByMonth)
        setAvailableMonths(months)
        
        // 가장 최근 월을 기본으로 선택
        if (months.length > 0) {
          const firstMonth = months[0]
          console.log('선택할 월:', firstMonth, '데이터:', detailsByMonth[firstMonth])
          setSelectedMonth(firstMonth)
          setSelectedStore(detailsByMonth[firstMonth])
          setSelectedCategory('과자') // 기본 탭을 과자로 설정
        } else {
          console.error('월 데이터가 없습니다')
        }
      } else {
        console.error('매장 데이터가 없습니다')
      }
    } catch (err: any) {
      console.error('매장 상세 정보 조회 중 오류:', err)
    } finally {
      setLoadingDetail(false)
    }
  }

  const handleStoreDetailClick = (storeCode: string) => {
    // 매장 상세 모달 바로 열기
    setSelectedStoreCode(storeCode)
    handleStoreDetailModalOpen(storeCode)
  }

  const handleStoreDetailModalOpen = (storeCode: string) => {
    fetchStoreDetail(storeCode)
    setStoreDetailTab('근거')
    setSelectedPatternType(null) // 패턴 선택 초기화
    setShowStoreDetailModal(true)
  }

  // 상품마스터에서 상품 정보 조회
  const fetchProductInfo = async (itemNm: string): Promise<ProductInfo | null> => {
    // 캐시 확인
    if (productInfoMap.has(itemNm)) {
      return productInfoMap.get(itemNm) || null
    }

    try {
      const { data, error } = await supabase
        .from('상품마스터')
        .select('ITEM_NM, item_img, ITEM_LRDV_NM, ITEM_MDDV_NM, ITEM_SMDV_NM, CPM_AMT, SLEM_AMT')
        .eq('ITEM_NM', itemNm)
        .limit(1)
        .single()

      if (error) {
        console.warn(`상품 정보 조회 실패: ${itemNm}`, error)
        return null
      }

      if (data) {
        const productInfo: ProductInfo = {
          item_nm: data.ITEM_NM || itemNm,
          item_img: data.item_img || null,
          item_lrdv_nm: data.ITEM_LRDV_NM || null,
          item_mddv_nm: data.ITEM_MDDV_NM || null,
          item_smdv_nm: data.ITEM_SMDV_NM || null,
          cpm_amt: data.CPM_AMT || null,
          slem_amt: data.SLEM_AMT || null,
        }
        
        // 캐시에 저장
        setProductInfoMap(prev => new Map(prev).set(itemNm, productInfo))
        return productInfo
      }

      return null
    } catch (err) {
      console.error('상품 정보 조회 중 오류:', err)
      return null
    }
  }

  // 여러 상품 정보 일괄 조회
  const fetchMultipleProductInfo = useCallback(async (itemNms: string[]) => {
    const uniqueItemNms = Array.from(new Set(itemNms))
    
    setProductInfoMap(prev => {
      const uncachedItems = uniqueItemNms.filter(nm => !prev.has(nm))
      return prev
    })

    const currentMap = productInfoMap
    const uncachedItems = uniqueItemNms.filter(nm => !currentMap.has(nm))
    
    if (uncachedItems.length === 0) {
      return
    }

    try {
      const { data, error } = await supabase
        .from('상품마스터')
        .select('ITEM_NM, item_img, ITEM_LRDV_NM, ITEM_MDDV_NM, ITEM_SMDV_NM, CPM_AMT, SLEM_AMT')
        .in('ITEM_NM', uncachedItems)

      if (error) {
        console.warn('상품 정보 일괄 조회 실패:', error)
        return
      }

      if (data && data.length > 0) {
        setProductInfoMap(prev => {
          const newMap = new Map(prev)
          data.forEach((item: any) => {
            const productInfo: ProductInfo = {
              item_nm: item.ITEM_NM || '',
              item_img: item.item_img || null,
              item_lrdv_nm: item.ITEM_LRDV_NM || null,
              item_mddv_nm: item.ITEM_MDDV_NM || null,
              item_smdv_nm: item.ITEM_SMDV_NM || null,
              cpm_amt: item.CPM_AMT || null,
              slem_amt: item.SLEM_AMT || null,
            }
            newMap.set(item.ITEM_NM, productInfo)
          })
          return newMap
        })
      }
    } catch (err) {
      console.error('상품 정보 일괄 조회 중 오류:', err)
    }
  }, [productInfoMap])

  // 상품 클릭 핸들러
  // IntersectionObserver 로직
  const handleIntersection = useCallback((entries: IntersectionObserverEntry[]) => {
    entries.forEach((entry) => {
      const itemId = entry.target.getAttribute('data-item-id')
      if (!itemId) return

      if (entry.isIntersecting) {
        setVisibleItems((prev) => new Set(prev).add(itemId))
      } else {
        setVisibleItems((prev) => {
          const next = new Set(prev)
          next.delete(itemId)
          return next
        })
      }
    })
  }, [])

  useEffect(() => {
    if (storeDetailTab !== '인기상품' || !selectedStore) return

    observerRef.current = new IntersectionObserver(handleIntersection, {
      rootMargin: '100px',
      threshold: 0.01,
    })

    itemRefs.current.forEach((element) => {
      if (element) {
        observerRef.current?.observe(element)
      }
    })

    return () => {
      observerRef.current?.disconnect()
    }
  }, [handleIntersection, storeDetailTab, selectedStore, selectedCategory])

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

  const handleProductClick = async (itemNm: string) => {
    let productInfo: ProductInfo | null | undefined = productInfoMap.get(itemNm)
    
    if (!productInfo) {
      productInfo = await fetchProductInfo(itemNm)
    }
    
    if (productInfo) {
      setSelectedProduct(productInfo)
    }
  }

  // 선택된 카테고리의 상품 정보 미리 로드
  useEffect(() => {
    if (selectedStore && selectedStore[selectedCategory]) {
      const categoryData = selectedStore[selectedCategory] as Record<string, string[]>
      const allProducts: string[] = []
      Object.values(categoryData).forEach(products => {
        allProducts.push(...products)
      })
      if (allProducts.length > 0) {
        fetchMultipleProductInfo(allProducts)
      }
    }
  }, [selectedStore, selectedCategory, fetchMultipleProductInfo])

  const categories: CategoryType[] = ['과자', '냉장', '맥주', '면', '미반', '빵', '음료']

  const formatSales = (sales: number) => {
    return new Intl.NumberFormat('ko-KR').format(sales)
  }


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
        <div className="max-w-[98%] mx-auto px-4 md:px-6 py-4 md:py-6">
          {/* 헤더 */}
          <div className="mb-8">
            <div className="flex items-start justify-between mb-6">
              <div className="flex-1">
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight mb-2">
                  우리 매장과 유사한 매장 찾기
                </h2>
                <p className="text-base md:text-lg text-gray-600 leading-relaxed">
                  한 달 동안 우리 매장과 가장 유사했던 매장들을 알려드립니다.
                </p>
              </div>
            </div>
            
            {/* 월별 탭 */}
            {currentStoreAvailableMonths.length > 0 && (
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-sm font-semibold text-gray-700">분석 기간</span>
                {currentStoreAvailableMonths.map((month) => (
                  <button
                    key={month}
                    onClick={() => handleCurrentMonthChange(month)}
                    className={`px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap rounded ${
                      currentSelectedMonth === month
                        ? 'bg-green-600 text-white'
                        : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {month}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 유사매장 목록과 지도 - 나란히 배치 */}
          {similarStores.length === 0 ? (
            <div className="text-center py-20 bg-gradient-to-br from-gray-50 to-green-50/30 rounded-2xl border-2 border-gray-200">
              <div className="w-16 h-16 bg-gradient-to-br from-gray-200 to-gray-300 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">유사 매장 데이터 없음</h3>
              <p className="text-gray-600 text-sm">해당 기간의 유사 매장 분석 데이터가 준비되지 않았습니다.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-[500px_1fr] gap-4 md:gap-6">
              {/* 왼쪽: 유사매장 목록 + 매장 정보 */}
              <div className="lg:order-1 space-y-4 md:space-y-6">
                {/* 유사매장 목록 */}
                <div className="bg-white border border-gray-300 overflow-hidden">
                  {/* 목록 헤더 */}
                  <div className="bg-white border-b border-gray-300 px-4 py-3 md:px-5 md:py-4">
                    <h3 className="text-lg font-bold text-gray-900 mb-1">유사 매장 순위</h3>
                    <p className="text-sm text-gray-500">유사 매장들의 선정근거와 각 매장별 인기 상품을 보여드립니다</p>
                  </div>
                  
                  {/* 스크롤 가능한 목록 */}
                  <div className="overflow-y-auto md:overflow-y-auto" style={{ height: 'calc(100vh - 180px)', minHeight: '400px' }}>
                    <div className="divide-y divide-gray-100">
                      {similarStores.map((store) => {
                        const isSelected = selectedStoreCode === store.store_code
                        return (
                        <div
                          key={store.store_code}
                          className={`px-4 py-6 md:px-6 md:py-5 transition-colors border-b border-gray-100 cursor-pointer active:bg-gray-100 ${
                            isSelected ? 'bg-green-50 border-l-4 border-l-green-600' : 'hover:bg-gray-50'
                          }`}
                          onClick={() => handleStoreDetailClick(store.store_code)}
                        >
                          <div className="flex items-start gap-3 md:gap-4">
                            <span className={`flex-shrink-0 w-10 h-10 md:w-8 md:h-8 flex items-center justify-center text-base md:text-sm font-bold ${
                              isSelected ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-600'
                            }`}>
                              {store.rank}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <p className={`text-base md:text-lg font-bold ${
                                  isSelected ? 'text-green-700' : 'text-gray-900'
                                }`} style={{ lineHeight: '1.8' }}>
                                  세븐일레븐 {store.store_nm}
                                </p>
                              </div>
                              {store.address && (
                                <p className="text-sm text-gray-500 line-clamp-2 md:line-clamp-1 leading-relaxed mb-3 md:mb-4">
                                  {store.address}
                                </p>
                              )}
                              {(store.영업시간 || store.매장면적) && (
                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                  {store.영업시간 && (
                                    <span>영업시간: {store.영업시간}</span>
                                  )}
                                  {store.영업시간 && store.매장면적 && (
                                    <span className="text-gray-400">·</span>
                                  )}
                                  {store.매장면적 && (
                                    <span>매장면적 {store.매장면적}m²</span>
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="flex-shrink-0 mt-1">
                              <svg
                                className="w-6 h-6 md:w-5 md:h-5 text-gray-400"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 5l7 7-7 7"
                              />
                            </svg>
                          </div>
                        </div>
                        </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* 오른쪽: 지도 (더 크게) */}
              <div className="lg:order-2">
                <div className="bg-white border border-gray-300 overflow-hidden h-full">
                  {/* 지도 헤더 */}
                  <div className="bg-white border-b border-gray-300 px-4 py-3 md:px-5 md:py-4">
                    <h3 className="text-base font-bold text-gray-900 mb-1">유사 매장 위치</h3>
                    {currentSelectedMonth && (
                      <p className="text-xs text-gray-500">기준 월: {currentSelectedMonth}</p>
                    )}
                  </div>
                  
                  {/* 지도 */}
                  <div className="relative h-[350px] md:h-[500px] min-h-[300px] md:min-h-[400px]">
                    <KakaoMap 
                      stores={currentStoreInfo ? [currentStoreInfo, ...similarStores] : similarStores}
                      currentStoreName={currentStoreName}
                      className="w-full h-full"
                      selectedStore={selectedStore ? {
                        store_code: selectedStore.store_code,
                        store_nm: selectedStore.store_nm,
                        월기준: selectedMonth
                      } : null}
                      onStoreDetailClick={handleStoreDetailModalOpen}
                      openStoreCode={openStoreCode}
                      selectedStoreCode={selectedStoreCode}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 판매 패턴 분석 섹션 - 지도 아래 */}
          {similarStores.length > 0 && currentStorePatterns && similarStoresPatterns.length > 0 && (
            <div className="mt-8 md:mt-12">
              <div className="mb-6 pb-4 border-b-2 border-gray-300">
                <div className="flex items-baseline gap-4">
                  <div className="w-1 h-10 bg-green-600"></div>
                  <div className="flex-1">
                    <h2 
                      className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight cursor-pointer hover:text-green-600 transition-colors inline-flex items-center gap-2"
                      onClick={() => setShowCriteriaModal(true)}
                    >
                      판매 패턴 분석
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </h2>
                    <p className="text-base text-gray-600 mt-1">유사매장들의 평균 판매 패턴과 우리 매장 비교</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 1. 카테고리별 판매 패턴 */}
                <div className="bg-white border-2 border-gray-300 rounded-xl p-6">
                  <div className="mb-4">
                    <h3 className="text-lg font-bold text-gray-900 mb-1">카테고리별 판매 패턴</h3>
                    <p className="text-sm text-gray-500">주요 카테고리 비교 분석</p>
                  </div>
                  <ResponsiveContainer width="100%" height={320}>
                    {(() => {
                      const myStorePattern = currentStorePatterns?.판매패턴
                      if (!myStorePattern) {
                        return <div className="flex items-center justify-center h-full text-gray-500">데이터를 불러오는 중...</div>
                      }

                      const myStoreData = myStorePattern.my_store || {}
                      const categories = myStorePattern.categories || []
                      
                      // 유사매장들의 평균 계산
                      const averageData: Record<string, number> = {}
                      categories.forEach((category: string) => {
                        let sum = 0
                        let count = 0
                        similarStoresPatterns.forEach(pattern => {
                          const value = pattern.판매패턴?.my_store?.[category] || 0
                          if (value > 0) {
                            sum += value
                            count++
                          }
                        })
                        averageData[category] = count > 0 ? sum / count : 0
                      })

                      const chartData = categories.map((category: string) => ({
                        category,
                        내매장: myStoreData[category] || 0,
                        유사매장평균: averageData[category] || 0,
                      }))

                      return (
                        <RadarChart data={chartData}>
                          <PolarGrid stroke="#e5e7eb" />
                          <PolarAngleAxis dataKey="category" tick={{ fontSize: 10, fill: '#374151' }} />
                          <PolarRadiusAxis angle={90} domain={[0, 30]} tick={{ fontSize: 9, fill: '#6b7280' }} />
                          <Radar name="내 매장" dataKey="내매장" stroke="#16a34a" fill="#16a34a" fillOpacity={0.7} strokeWidth={2} />
                          <Radar name="유사 매장" dataKey="유사매장평균" stroke="#fb923c" fill="none" strokeWidth={2.5} />
                          <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} iconType="square" />
                        </RadarChart>
                      )
                    })()}
                  </ResponsiveContainer>
                  
                  {/* 유사도 근거 */}
                  {(() => {
                    const myStorePattern = currentStorePatterns?.판매패턴
                    if (!myStorePattern) return null

                    const myStoreData = myStorePattern.my_store || {}
                    const categories = myStorePattern.categories || []
                    
                    const averageData: Record<string, number> = {}
                    categories.forEach((category: string) => {
                      let sum = 0
                      let count = 0
                      similarStoresPatterns.forEach(pattern => {
                        const value = pattern.판매패턴?.my_store?.[category] || 0
                        if (value > 0) {
                          sum += value
                          count++
                        }
                      })
                      averageData[category] = count > 0 ? sum / count : 0
                    })

                    let totalDiff = 0
                    let categoryCount = 0
                    const categoryDiffs: Array<{category: string, diff: number, myValue: number, similarValue: number}> = []
                    
                    categories.forEach((category: string) => {
                      const myValue = myStoreData[category] || 0
                      const avgValue = averageData[category] || 0
                      if (myValue > 0 || avgValue > 0) {
                        const diff = Math.abs(myValue - avgValue)
                        totalDiff += diff
                        categoryCount++
                        categoryDiffs.push({ category, diff, myValue, similarValue: avgValue })
                      }
                    })
                    
                    const avgDiff = categoryCount > 0 ? totalDiff / categoryCount : 0
                    const similarityScore = Math.max(0, 100 - (avgDiff * 2))

                    return (
                      <div className="mt-6 pt-6 border-t-2 border-gray-100">
                        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4 space-y-3">
                          <h5 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <div className="w-1 h-4 bg-green-600 rounded-full"></div>
                            유사도 근거
                          </h5>
                          <div className="space-y-3 text-lg text-gray-800 leading-loose tracking-wide whitespace-pre-line font-medium">
                            유사매장들과의 판매 패턴 분석 결과, 조리빵과 주류 카테고리에서 높은 유사성을 보였으며, 과자와 미반 카테고리에서는 상대적으로 큰 차이를 나타냈습니다.
                          </div>
                        </div>
                      </div>
                    )
                  })()}
                </div>

                {/* 2. 시간대별 판매 패턴 */}
                <div className="bg-white border-2 border-gray-300 rounded-xl p-6">
                  <div className="mb-4">
                    <h3 className="text-lg font-bold text-gray-900 mb-1">시간대별 판매 패턴</h3>
                  </div>
                  
                  {/* 주중/주말 탭 */}
                  <div className="flex gap-2 mb-4">
                    <button
                      onClick={() => setAverageComparisonTab('주중')}
                      className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                        averageComparisonTab === '주중'
                          ? 'bg-green-600 text-white shadow-sm'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      주중
                    </button>
                    <button
                      onClick={() => setAverageComparisonTab('주말')}
                      className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                        averageComparisonTab === '주말'
                          ? 'bg-green-600 text-white shadow-sm'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      주말
                    </button>
                  </div>

                  <div className="mb-2">
                    <p className="text-sm font-semibold text-gray-700">{averageComparisonTab} 시간대별 판매 비율</p>
                  </div>
                  
                  <ResponsiveContainer width="100%" height={300}>
                    {(() => {
                      const myStorePattern = currentStorePatterns?.시간대패턴
                      if (!myStorePattern) {
                        return <div className="flex items-center justify-center h-full text-gray-500">데이터를 불러오는 중...</div>
                      }

                      const timeSlots = myStorePattern.time_slots || []
                      const myStoreData = averageComparisonTab === '주중' 
                        ? (myStorePattern.weekday?.my_store || [])
                        : (myStorePattern.weekend?.my_store || [])
                      
                      // 유사매장들의 평균 계산
                      const averageData: number[] = []
                      timeSlots.forEach((slot: string, index: number) => {
                        let sum = 0
                        let count = 0
                        similarStoresPatterns.forEach(pattern => {
                          const timePattern = pattern.시간대패턴
                          if (timePattern) {
                            const data = averageComparisonTab === '주중'
                              ? (timePattern.weekday?.my_store || [])
                              : (timePattern.weekend?.my_store || [])
                            const value = data[index] || 0
                            if (value > 0) {
                              sum += value
                              count++
                            }
                          }
                        })
                        averageData.push(count > 0 ? sum / count : 0)
                      })

                      const chartData = timeSlots.map((slot: string, index: number) => {
                        const formattedSlot = slot.replace('(', '\n(').replace(')', '시)')
                        return {
                          time: formattedSlot,
                          내매장: myStoreData[index] || 0,
                          유사매장평균: averageData[index] || 0,
                        }
                      })

                      return (
                        <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis 
                            dataKey="time" 
                            tick={{ fontSize: 10, fill: '#374151' }}
                            interval={0}
                          />
                          <YAxis 
                            domain={[0, 60]} 
                            ticks={[0, 15, 30, 45, 60]}
                            tick={{ fontSize: 10, fill: '#6b7280' }}
                          />
                          <Tooltip 
                            formatter={(value: number) => `${value}%`}
                            contentStyle={{ fontSize: '11px', border: '1px solid #e5e7eb', borderRadius: '4px' }}
                          />
                          <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                          <Line 
                            type="monotone" 
                            dataKey="내매장" 
                            stroke="#16a34a" 
                            strokeWidth={2.5} 
                            name="내 매장" 
                            dot={{ fill: '#16a34a', r: 4, strokeWidth: 0 }} 
                            activeDot={{ r: 5 }}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="유사매장평균" 
                            stroke="#fb923c" 
                            strokeWidth={2.5} 
                            name="유사 매장" 
                            dot={{ fill: '#fb923c', r: 4, strokeWidth: 0 }}
                            activeDot={{ r: 5 }}
                          />
                        </LineChart>
                      )
                    })()}
                  </ResponsiveContainer>

                  {/* 유사도 근거 */}
                  {(() => {
                    const myStorePattern = currentStorePatterns?.시간대패턴
                    if (!myStorePattern) return null

                    const timeSlots = myStorePattern.time_slots || []
                    const myWeekday = myStorePattern.weekday?.my_store || []
                    const myWeekend = myStorePattern.weekend?.my_store || []
                    
                    // 유사매장 평균 계산
                    const avgWeekday: number[] = []
                    const avgWeekend: number[] = []
                    timeSlots.forEach((slot: string, index: number) => {
                      let weekdaySum = 0, weekendSum = 0
                      let weekdayCount = 0, weekendCount = 0
                      similarStoresPatterns.forEach(pattern => {
                        const timePattern = pattern.시간대패턴
                        if (timePattern) {
                          const weekdayData = timePattern.weekday?.my_store || []
                          const weekendData = timePattern.weekend?.my_store || []
                          const weekdayValue = weekdayData[index] || 0
                          const weekendValue = weekendData[index] || 0
                          if (weekdayValue > 0) {
                            weekdaySum += weekdayValue
                            weekdayCount++
                          }
                          if (weekendValue > 0) {
                            weekendSum += weekendValue
                            weekendCount++
                          }
                        }
                      })
                      avgWeekday.push(weekdayCount > 0 ? weekdaySum / weekdayCount : 0)
                      avgWeekend.push(weekendCount > 0 ? weekendSum / weekendCount : 0)
                    })

                    const myWeekdayAfternoon = myWeekday[2] || 0
                    const avgWeekdayAfternoon = avgWeekday[2] || 0
                    const myWeekendEvening = myWeekend[3] || 0
                    const avgWeekendEvening = avgWeekend[3] || 0
                    
                    const weekdayAfternoonDiff = Math.abs(myWeekdayAfternoon - avgWeekdayAfternoon)
                    const weekendEveningDiff = Math.abs(myWeekendEvening - avgWeekendEvening)

                    return (
                      <div className="mt-6 pt-6 border-t-2 border-gray-100">
                        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4 space-y-3">
                          <h5 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <div className="w-1 h-4 bg-green-600 rounded-full"></div>
                            유사도 근거
                          </h5>
                          <div className="space-y-3 text-lg text-gray-800 leading-loose tracking-wide whitespace-pre-line font-medium">
                            {averageComparisonTab === '주중' ? (
                              <>주중 시간대별 판매 패턴 분석 결과, 저녁 시간대의 매출이 가장 집중되고 있으며, 이는 유사 매장들과 유사한 경향을 보입니다. 이 시간대의 매출 비중은 전체에서 두드러진 것으로 확인되었습니다.</>
                            ) : (
                              <>주말 저녁 시간대의 판매 패턴이 유사한 다른 시간대와 비교해 차이가 거의 없는 것으로 나타났습니다. 또한, 매출의 대부분이 오후 시간대에 집중되어 있으며, 이는 유사 매장들과 유사한 경향을 보입니다.</>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })()}
                </div>

                {/* 3. 주중/주말 판매패턴 */}
                <div className="bg-white border-2 border-gray-300 rounded-xl p-6">
                  <div className="mb-4">
                    <h3 className="text-lg font-bold text-gray-900 mb-1">주중/주말 판매패턴</h3>
                    <p className="text-sm text-gray-500">주중 매출 비중 (주말은 1.0으로 고정)</p>
                  </div>
                  
                  <ResponsiveContainer width="100%" height={240}>
                    {(() => {
                      const myStorePattern = currentStorePatterns?.주중주말패턴
                      if (!myStorePattern) {
                        return <div className="flex items-center justify-center h-full text-gray-500">데이터를 불러오는 중...</div>
                      }

                      const myStoreRatio = myStorePattern.my_store?.weekend_ratio || 0
                      
                      // 유사매장들의 평균 계산
                      let sumRatio = 0
                      let count = 0
                      similarStoresPatterns.forEach(pattern => {
                        const weekdayWeekend = pattern.주중주말패턴?.my_store
                        if (weekdayWeekend && weekdayWeekend.weekend_ratio !== undefined) {
                          const ratio = weekdayWeekend.weekend_ratio
                          sumRatio += ratio
                          count++
                        }
                      })
                      const avgRatio = count > 0 ? sumRatio / count : 0

                      const chartData = [
                        { name: '내 매장', value: myStoreRatio },
                        { name: '유사 매장', value: avgRatio },
                      ]

                      const maxValue = Math.max(myStoreRatio, avgRatio, 1.3)
                      const minValue = Math.min(myStoreRatio, avgRatio, 0.9)

                      return (
                        <BarChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#374151' }} />
                          <YAxis 
                            tick={{ fontSize: 9, fill: '#6b7280' }} 
                            domain={[Math.max(0.8, minValue - 0.1), Math.min(1.5, maxValue + 0.1)]}
                            tickFormatter={(value: number) => value.toFixed(2)}
                          />
                          <Tooltip 
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                const data = payload[0].payload;
                                const label = data.name || '값';
                                const value = payload[0].value as number;
                                return (
                                  <div className="bg-white p-2 border border-gray-200 rounded shadow-sm text-xs">
                                    <p className="text-gray-700">{label}: {value.toFixed(2)}</p>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                            <Cell fill="#16a34a" />
                            <Cell fill="#fb923c" />
                          </Bar>
                        </BarChart>
                      )
                    })()}
                  </ResponsiveContainer>
                  <p className="text-sm text-gray-500 mt-2">1.0 초과시 주중 매출 비중 &gt; 주말 매출 비중</p>

                  {/* 유사도 근거 */}
                  {(() => {
                    const myStorePattern = currentStorePatterns?.주중주말패턴
                    if (!myStorePattern) return null

                    const myWeekdayWeekend = myStorePattern.my_store
                    if (!myWeekdayWeekend) return null

                    const myWeekendRatio = myWeekdayWeekend.weekend_ratio || 0
                    const myWeekendWeekdayRatio = myWeekendRatio || 0 // 주중은 1로 고정이므로 주말 값만 사용

                    // 유사매장 평균 계산
                    let sumRatio = 0
                    let count = 0
                    similarStoresPatterns.forEach(pattern => {
                      const weekdayWeekend = pattern.주중주말패턴?.my_store
                      if (weekdayWeekend && weekdayWeekend.weekend_ratio !== undefined) {
                        const ratio = weekdayWeekend.weekend_ratio
                        sumRatio += ratio
                        count++
                      }
                    })
                    const avgRatio = count > 0 ? sumRatio / count : 0

                    const ratioDiff = Math.abs(myWeekendWeekdayRatio - avgRatio)
                    const weekendPercentDiff = myWeekendWeekdayRatio > 0 ? ((myWeekendWeekdayRatio - 1) * 100) : 0

                    return (
                      <div className="mt-6 pt-6 border-t-2 border-gray-100">
                        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4 space-y-3">
                          <h5 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <div className="w-1 h-4 bg-green-600 rounded-full"></div>
                            유사도 근거
                          </h5>
                          <div className="space-y-3 text-lg text-gray-800 leading-loose tracking-wide whitespace-pre-line font-medium">
                            우리 매장은 유사 매장들보다 주중 판매 비중이 상대적으로 더 높으며, 주말 대비 주중 판매 비율이 우세한 경향을 보입니다. 이러한 주중 중심형 판매 패턴은 우리 매장이 유사 매장들과 유사한 성향을 가지고 있음을 나타냅니다.
                          </div>
                        </div>
                      </div>
                    )
                  })()}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>


      {/* 매장 상세 정보 모달 */}
      {showStoreDetailModal && selectedStore && availableMonths.length > 0 && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-0 md:p-4"
          onClick={() => setShowStoreDetailModal(false)}
        >
          <div
            className="bg-white rounded-lg md:rounded-lg max-w-[100vw] md:max-w-[95vw] w-full max-h-[100vh] md:max-h-[95vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 모달 헤더 */}
            <div className="sticky top-0 bg-white px-4 py-4 md:px-8 md:py-6 z-10">
              <div className="flex items-start justify-between mb-3 md:mb-4">
                <div className="flex-1">
                  <div className="flex items-baseline gap-3 md:gap-4 mb-2">
                    <div className="w-1 h-8 md:h-10 bg-green-600"></div>
                    <div>
                      <h3 className="text-xl md:text-2xl font-bold text-gray-900">
                        {selectedStore.store_nm || ''}
                      </h3>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowStoreDetailModal(false)}
                    className="w-10 h-10 md:w-8 md:h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 active:bg-gray-200 transition-colors rounded-lg"
                  >
                    <svg className="w-6 h-6 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              {/* 탭 버튼 */}
              <div className="flex items-center gap-1 md:gap-2 border-b-2 border-gray-300">
                <button
                  onClick={() => setStoreDetailTab('근거')}
                  className={`flex-1 md:flex-none px-4 py-3 md:px-8 md:py-4 text-sm md:text-base font-semibold transition-colors border-b-2 ${
                    storeDetailTab === '근거'
                      ? 'border-green-600 text-green-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 active:text-gray-700'
                  }`}
                >
                  유사매장 선정근거
                </button>
                <button
                  onClick={() => setStoreDetailTab('인기상품')}
                  className={`flex-1 md:flex-none px-4 py-3 md:px-8 md:py-4 text-sm md:text-base font-semibold transition-colors border-b-2 ${
                    storeDetailTab === '인기상품'
                      ? 'border-green-600 text-green-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 active:text-gray-700'
                  }`}
                >
                  {selectedStore?.store_nm || '유사매장'} 인기상품
                </button>
              </div>
            </div>

            {/* 모달 내용 */}
            <div className="px-4 py-2 md:px-8 md:py-2">
              {/* 유사매장 근거 탭 */}
              {storeDetailTab === '근거' && (
                <>
                  {/* 유사도 분석 섹션 - 세 개의 패널 나란히 */}
                  <div className="mb-8 pb-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                  {/* 판매 패턴 유사도 */}
                  <div 
                    className={`bg-white rounded-xl border flex flex-col cursor-pointer transition-all overflow-hidden ${
                      selectedPatternType === '판매패턴' 
                        ? 'border-green-500 shadow-xl ring-2 ring-green-500/20' 
                        : 'border-gray-200 shadow-sm hover:shadow-md hover:border-green-300'
                    }`}
                    onClick={() => setSelectedPatternType(selectedPatternType === '판매패턴' ? null : '판매패턴')}
                  >
                    <div className={`px-6 py-4 border-b ${
                      selectedPatternType === '판매패턴' 
                        ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200' 
                        : 'bg-gray-50 border-gray-200'
                    }`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-1 h-6 rounded-full ${
                          selectedPatternType === '판매패턴' ? 'bg-green-600' : 'bg-gray-400'
                        }`}></div>
                        <h4 className="text-lg font-bold text-gray-900 tracking-tight">카테고리별 판매 패턴</h4>
                      </div>
                    </div>
                    <div className="p-6 space-y-4">
                      <div className="pt-2">
                        <p className="text-sm font-semibold text-gray-700 mb-1">카테고리별 판매 패턴</p>
                        <p className="text-sm text-gray-500 mb-4">주요 카테고리 비교 분석</p>
                        <ResponsiveContainer width="100%" height={320}>
                          {(() => {
                            // 현재 매장과 유사매장의 판매패턴 데이터 가져오기
                            const myStorePattern = currentStorePatterns?.판매패턴
                            const similarStorePattern = selectedStore?.판매패턴
                            
                            // 데이터가 없으면 빈 배열 반환
                            if (!myStorePattern || !similarStorePattern) {
                              return <div className="flex items-center justify-center h-full text-gray-500">데이터를 불러오는 중...</div>
                            }
                            
                            const myStoreData = myStorePattern.my_store || {}
                            const similarStoreData = similarStorePattern.my_store || {}
                            const categories = myStorePattern.categories || similarStorePattern.categories || []
                            
                            // 차트 데이터 생성
                            const chartData = categories.map((category: string) => ({
                              category,
                              내매장: myStoreData[category] || 0,
                              유사매장: similarStoreData[category] || 0,
                            }))
                            
                            return (
                              <RadarChart data={chartData}>
                                <PolarGrid stroke="#e5e7eb" />
                                <PolarAngleAxis dataKey="category" tick={{ fontSize: 10, fill: '#374151' }} />
                                <PolarRadiusAxis angle={90} domain={[0, 30]} tick={{ fontSize: 9, fill: '#6b7280' }} />
                                <Radar name="내 매장" dataKey="내매장" stroke="#16a34a" fill="#16a34a" fillOpacity={0.7} strokeWidth={2} />
                                <Radar name={selectedStore?.store_nm || "유사 매장"} dataKey="유사매장" stroke="#fb923c" fill="none" strokeWidth={2.5} />
                                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} iconType="square" />
                              </RadarChart>
                            )
                          })()}
                        </ResponsiveContainer>
                      </div>
                      {/* 판매 패턴 관련 근거 */}
                      {(() => {
                        const myStorePattern = currentStorePatterns
                        const selectedStoreData = selectedStore
                        
                        if (!myStorePattern || !selectedStoreData) return null
                        
                        const mySalesPattern = myStorePattern.판매패턴?.my_store || {}
                        const similarSalesPattern = selectedStoreData.판매패턴?.my_store || {}
                        const categories = myStorePattern.판매패턴?.categories || []
                        
                        // 유사도 계산
                        let totalDiff = 0
                        let categoryCount = 0
                        const categoryDiffs: Array<{category: string, diff: number, myValue: number, similarValue: number}> = []
                        
                        categories.forEach((category: string) => {
                          const myValue = mySalesPattern[category] || 0
                          const similarValue = similarSalesPattern[category] || 0
                          if (myValue > 0 || similarValue > 0) {
                            const diff = Math.abs(myValue - similarValue)
                            totalDiff += diff
                            categoryCount++
                            categoryDiffs.push({ category, diff, myValue, similarValue })
                          }
                        })
                        
                        const avgDiff = categoryCount > 0 ? totalDiff / categoryCount : 0
                        const similarityScore = Math.max(0, 100 - (avgDiff * 2))
                        
                        // 유사매장의 유사도 근거 가져오기
                        const similarStorePatternData = similarStoresPatterns.find(
                          p => p.store_code === selectedStore?.store_code
                        )
                        const similarityReason = similarStorePatternData?.판매패턴_유사도근거
                        
                        return (
                          <div className="mt-6 pt-6 border-t-2 border-gray-100">
                            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4 space-y-3">
                              <h5 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <div className="w-1 h-4 bg-green-600 rounded-full"></div>
                                유사도 근거
                              </h5>
                              {similarityReason ? (
                                <div className="space-y-3 text-lg text-gray-800 leading-loose tracking-wide whitespace-pre-line font-medium">
                                  {similarityReason}
                                </div>
                              ) : (
                                <div className="space-y-2.5 text-base text-gray-700 leading-relaxed">
                                  <div className="flex items-start gap-2.5">
                                    <div className="w-1.5 h-1.5 bg-green-600 rounded-full mt-2 flex-shrink-0"></div>
                                    <p className="flex-1">
                                      고객 방문 패턴 유사도 <span className="font-bold text-green-700">{similarityScore.toFixed(0)}% 이상</span>으로 상권 특성과 고객층 구성이 유사합니다.
                                    </p>
                                  </div>
                                  <div className="flex items-start gap-2.5">
                                    <div className="w-1.5 h-1.5 bg-green-600 rounded-full mt-2 flex-shrink-0"></div>
                                    <p className="flex-1">
                                      주요 카테고리별 판매 비중이 거의 동일하여 <span className="font-semibold text-gray-900">고객 니즈와 구매 패턴이 유사</span>합니다.
                                    </p>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })()}
                    </div>
                  </div>

                  {/* 시간대 패턴 유사도 */}
                  <div 
                    className={`bg-white rounded-xl border flex flex-col cursor-pointer transition-all overflow-hidden ${
                      selectedPatternType === '시간대패턴' 
                        ? 'border-green-500 shadow-xl ring-2 ring-green-500/20' 
                        : 'border-gray-200 shadow-sm hover:shadow-md hover:border-green-300'
                    }`}
                    onClick={() => setSelectedPatternType(selectedPatternType === '시간대패턴' ? null : '시간대패턴')}
                  >
                    <div className={`px-6 py-4 border-b ${
                      selectedPatternType === '시간대패턴' 
                        ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200' 
                        : 'bg-gray-50 border-gray-200'
                    }`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-1 h-6 rounded-full ${
                          selectedPatternType === '시간대패턴' ? 'bg-green-600' : 'bg-gray-400'
                        }`}></div>
                        <h4 className="text-lg font-bold text-gray-900 tracking-tight">시간대별 판매 패턴</h4>
                      </div>
                    </div>
                    <div className="p-6 space-y-4">
                      {/* 주중/주말 탭 */}
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setTimePatternTab('주중')
                          }}
                          className={`flex-1 px-4 py-2.5 rounded-lg text-base font-semibold transition-all ${
                            timePatternTab === '주중'
                              ? 'bg-green-600 text-white shadow-sm'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          주중
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setTimePatternTab('주말')
                          }}
                          className={`flex-1 px-4 py-2.5 rounded-lg text-base font-semibold transition-all ${
                            timePatternTab === '주말'
                              ? 'bg-green-600 text-white shadow-sm'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          주말
                        </button>
                      </div>

                      <div className="pt-2">
                        <p className="text-base font-semibold text-gray-700 mb-1">{timePatternTab} 시간대별 판매 비율</p>
                        <ResponsiveContainer width="100%" height={300}>
                          {(() => {
                            // 현재 매장과 유사매장의 시간대패턴 데이터 가져오기
                            const myStorePattern = currentStorePatterns?.시간대패턴
                            const similarStorePattern = selectedStore?.시간대패턴
                            
                            // 데이터가 없으면 빈 배열 반환
                            if (!myStorePattern || !similarStorePattern) {
                              return <div className="flex items-center justify-center h-full text-gray-500">데이터를 불러오는 중...</div>
                            }
                            
                            const timeSlots = myStorePattern.time_slots || similarStorePattern.time_slots || []
                            const myStoreData = timePatternTab === '주중' 
                              ? (myStorePattern.weekday?.my_store || [])
                              : (myStorePattern.weekend?.my_store || [])
                            const similarStoreData = timePatternTab === '주중'
                              ? (similarStorePattern.weekday?.my_store || [])
                              : (similarStorePattern.weekend?.my_store || [])
                            
                            // 차트 데이터 생성
                            const chartData = timeSlots.map((slot: string, index: number) => {
                              // 시간대 포맷팅 (예: "심야(0-6)" -> "심야\n(0-6시)")
                              const formattedSlot = slot.replace('(', '\n(').replace(')', '시)')
                              return {
                                time: formattedSlot,
                                내매장: myStoreData[index] || 0,
                                유사매장: similarStoreData[index] || 0,
                              }
                            })
                            
                            return (
                              <LineChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                <XAxis 
                                  dataKey="time" 
                                  tick={{ fontSize: 10, fill: '#374151' }}
                                  interval={0}
                                />
                                <YAxis 
                                  domain={[0, 60]} 
                                  ticks={[0, 15, 30, 45, 60]}
                                  tick={{ fontSize: 10, fill: '#6b7280' }}
                                />
                                <Tooltip 
                                  formatter={(value: number) => `${value}%`}
                                  contentStyle={{ fontSize: '11px', border: '1px solid #e5e7eb', borderRadius: '4px' }}
                                />
                                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                                <Line 
                                  type="monotone" 
                                  dataKey="내매장" 
                                  stroke="#16a34a" 
                                  strokeWidth={2.5} 
                                  name="내 매장" 
                                  dot={{ fill: '#16a34a', r: 4, strokeWidth: 0 }} 
                                  activeDot={{ r: 5 }}
                                />
                                <Line 
                                  type="monotone" 
                                  dataKey="유사매장" 
                                  stroke="#fb923c" 
                                  strokeWidth={2.5} 
                                  name={selectedStore?.store_nm || "유사 매장"} 
                                  dot={{ fill: '#fb923c', r: 4, strokeWidth: 0 }}
                                  activeDot={{ r: 5 }}
                                />
                              </LineChart>
                            )
                          })()}
                        </ResponsiveContainer>
                      </div>
                      {/* 시간대 패턴 관련 근거 */}
                      {(() => {
                        const myStorePattern = currentStorePatterns
                        const selectedStoreData = selectedStore
                        
                        if (!myStorePattern || !selectedStoreData) return null
                        
                        const myTimePattern = myStorePattern.시간대패턴
                        const similarTimePattern = selectedStoreData.시간대패턴
                        
                        if (!myTimePattern || !similarTimePattern) return null
                        
                        const myWeekday = myTimePattern.weekday?.my_store || []
                        const similarWeekday = similarTimePattern.weekday?.my_store || []
                        const myWeekend = myTimePattern.weekend?.my_store || []
                        const similarWeekend = similarTimePattern.weekend?.my_store || []
                        const timeSlots = myTimePattern.time_slots || similarTimePattern.time_slots || []
                        
                        // 주중 패턴 분석
                        const weekdayDiffs = timeSlots.map((slot: string, index: number) => ({
                          slot,
                          diff: Math.abs((myWeekday[index] || 0) - (similarWeekday[index] || 0)),
                          myValue: myWeekday[index] || 0,
                          similarValue: similarWeekday[index] || 0
                        }))
                        const weekdayMaxIndex = weekdayDiffs.reduce((maxIdx: number, item: any, idx: number, arr: any[]) => 
                          (item.myValue + item.similarValue) > (arr[maxIdx].myValue + arr[maxIdx].similarValue) ? idx : maxIdx, 0
                        )
                        
                        // 주말 패턴 분석
                        const weekendDiffs = timeSlots.map((slot: string, index: number) => ({
                          slot,
                          diff: Math.abs((myWeekend[index] || 0) - (similarWeekend[index] || 0)),
                          myValue: myWeekend[index] || 0,
                          similarValue: similarWeekend[index] || 0
                        }))
                        const weekendMaxIndex = weekendDiffs.reduce((maxIdx: number, item: any, idx: number, arr: any[]) => 
                          (item.myValue + item.similarValue) > (arr[maxIdx].myValue + arr[maxIdx].similarValue) ? idx : maxIdx, 0
                        )
                        
                        const myWeekdayAfternoon = myWeekday[2] || 0
                        const similarWeekdayAfternoon = similarWeekday[2] || 0
                        const myWeekendEvening = myWeekend[3] || 0
                        const similarWeekendEvening = similarWeekend[3] || 0
                        
                        const weekdayAfternoonDiff = Math.abs(myWeekdayAfternoon - similarWeekdayAfternoon)
                        const weekendEveningDiff = Math.abs(myWeekendEvening - similarWeekendEvening)
                        
                        // 유사매장의 유사도 근거 가져오기 (주중/주말에 따라)
                        const similarStorePatternData = similarStoresPatterns.find(
                          p => p.store_code === selectedStore?.store_code
                        )
                        const similarityReason = timePatternTab === '주중' 
                          ? similarStorePatternData?.주중_시간대패턴_유사도근거
                          : similarStorePatternData?.주말_시간대패턴_유사도근거
                        
                        return (
                          <div className="mt-6 pt-6 border-t-2 border-gray-100">
                            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4 space-y-3">
                              <h5 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <div className="w-1 h-4 bg-green-600 rounded-full"></div>
                                유사도 근거
                              </h5>
                              {similarityReason ? (
                                <div className="space-y-3 text-lg text-gray-800 leading-loose tracking-wide whitespace-pre-line font-medium">
                                  {similarityReason}
                                </div>
                              ) : (
                                <div className="space-y-2.5 text-base text-gray-700 leading-relaxed">
                                  {weekdayAfternoonDiff < 5 && (
                                    <div className="flex items-start gap-2.5">
                                      <div className="w-1.5 h-1.5 bg-green-600 rounded-full mt-2 flex-shrink-0"></div>
                                      <p className="flex-1">
                                        <span className="font-semibold text-gray-900">주중 오후 12-18시</span>에 매출이 집중되는 패턴이 유사합니다 (차이 {weekdayAfternoonDiff.toFixed(1)}%p).
                                      </p>
                                    </div>
                                  )}
                                  {weekendEveningDiff < 5 && (
                                    <div className="flex items-start gap-2.5">
                                      <div className="w-1.5 h-1.5 bg-green-600 rounded-full mt-2 flex-shrink-0"></div>
                                      <p className="flex-1">
                                        <span className="font-semibold text-gray-900">주말 저녁 18-24시</span>에 매출이 집중되는 패턴이 유사합니다 (차이 {weekendEveningDiff.toFixed(1)}%p).
                                      </p>
                                    </div>
                                  )}
                                  {timeSlots[weekdayMaxIndex] && (
                                    <div className="flex items-start gap-2.5">
                                      <div className="w-1.5 h-1.5 bg-green-600 rounded-full mt-2 flex-shrink-0"></div>
                                      <p className="flex-1">
                                        주중 <span className="font-semibold text-gray-900">{timeSlots[weekdayMaxIndex]}</span> 시간대에 매출이 가장 집중되는 패턴이 일치합니다.
                                      </p>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })()}
                    </div>
                  </div>

                  {/* 주중/주말 패턴 유사도 */}
                  <div 
                    className={`bg-white rounded-xl border flex flex-col cursor-pointer transition-all overflow-hidden ${
                      selectedPatternType === '주중주말패턴' 
                        ? 'border-green-500 shadow-xl ring-2 ring-green-500/20' 
                        : 'border-gray-200 shadow-sm hover:shadow-md hover:border-green-300'
                    }`}
                    onClick={() => setSelectedPatternType(selectedPatternType === '주중주말패턴' ? null : '주중주말패턴')}
                  >
                    <div className={`px-6 py-4 border-b ${
                      selectedPatternType === '주중주말패턴' 
                        ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200' 
                        : 'bg-gray-50 border-gray-200'
                    }`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-1 h-6 rounded-full ${
                          selectedPatternType === '주중주말패턴' ? 'bg-green-600' : 'bg-gray-400'
                        }`}></div>
                        <h4 className="text-lg font-bold text-gray-900 tracking-tight">주중/주말 판매패턴</h4>
                      </div>
                    </div>
                    <div className="p-6 space-y-4">
                      <div className="pt-2">
                        <p className="text-sm font-semibold text-gray-700 mb-1">주중 매출 비중</p>
                        <p className="text-sm text-gray-500 mb-4">주중 매출 비중 (주말은 1.0으로 고정)</p>
                        <ResponsiveContainer width="100%" height={240}>
                          {(() => {
                            // 현재 매장과 유사매장의 주중주말패턴 데이터 가져오기
                            const myStorePattern = currentStorePatterns?.주중주말패턴
                            const similarStorePattern = selectedStore?.주중주말패턴
                            
                            // 데이터가 없으면 빈 배열 반환
                            if (!myStorePattern || !similarStorePattern) {
                              return <div className="flex items-center justify-center h-full text-gray-500">데이터를 불러오는 중...</div>
                            }
                            
                            const myStoreRatio = myStorePattern.my_store?.weekend_ratio || 0
                            const similarStoreRatio = similarStorePattern.my_store?.weekend_ratio || 0
                            
                            const chartData = [
                              { name: '내 매장', value: myStoreRatio },
                              { name: selectedStore?.store_nm || '유사 매장', value: similarStoreRatio },
                            ]
                            
                            // 도메인 계산 (값에 따라 동적으로 조정)
                            const maxValue = Math.max(myStoreRatio, similarStoreRatio, 1.3)
                            const minValue = Math.min(myStoreRatio, similarStoreRatio, 0.9)
                            
                            return (
                              <BarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#374151' }} />
                                <YAxis 
                                  tick={{ fontSize: 9, fill: '#6b7280' }} 
                                  domain={[Math.max(0.8, minValue - 0.1), Math.min(1.5, maxValue + 0.1)]}
                                  tickFormatter={(value: number) => value.toFixed(2)}
                                />
                                <Tooltip 
                                  content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                      const data = payload[0].payload;
                                      const label = data.name || '값';
                                      const value = payload[0].value as number;
                                      return (
                                        <div className="bg-white p-2 border border-gray-200 rounded shadow-sm text-xs">
                                          <p className="text-gray-700">{label}: {value.toFixed(2)}</p>
                                        </div>
                                      );
                                    }
                                    return null;
                                  }}
                                />
                                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                  <Cell fill="#16a34a" />
                                  <Cell fill="#fb923c" />
                                </Bar>
                              </BarChart>
                            )
                          })()}
                        </ResponsiveContainer>
                        <p className="text-sm text-gray-500 mt-2">1.0 초과시 주중 매출 비중 &gt; 주말 매출 비중</p>
                      </div>
                      {/* 주중/주말 패턴 관련 근거 */}
                      {(() => {
                        const myStorePattern = currentStorePatterns
                        const selectedStoreData = selectedStore
                        
                        if (!myStorePattern || !selectedStoreData) return null
                        
                        const myWeekdayWeekend = myStorePattern.주중주말패턴?.my_store
                        const similarWeekdayWeekend = selectedStoreData.주중주말패턴?.my_store
                        
                        if (!myWeekdayWeekend || !similarWeekdayWeekend) return null
                        
                        const myWeekendRatio = myWeekdayWeekend.weekend_ratio || 0
                        const similarWeekendRatio = similarWeekdayWeekend.weekend_ratio || 0
                        
                        const myWeekendWeekdayRatio = myWeekendRatio || 0 // 주중은 1로 고정이므로 주말 값만 사용
                        const similarWeekendWeekdayRatio = similarWeekendRatio || 0 // 주중은 1로 고정이므로 주말 값만 사용
                        
                        const ratioDiff = Math.abs(myWeekendWeekdayRatio - similarWeekendWeekdayRatio)
                        const weekendPercentDiff = myWeekendWeekdayRatio > 0 ? ((myWeekendWeekdayRatio - 1) * 100) : 0
                        const similarWeekendPercentDiff = similarWeekendWeekdayRatio > 0 ? ((similarWeekendWeekdayRatio - 1) * 100) : 0
                        
                        // 주말 비율 유사도 계산
                        const weekendRatioDiff = Math.abs(myWeekendRatio - similarWeekendRatio)
                        
                        // 유사매장의 유사도 근거 가져오기
                        const similarStorePatternData = similarStoresPatterns.find(
                          p => p.store_code === selectedStore?.store_code
                        )
                        const similarityReason = similarStorePatternData?.주중주말_유사도근거
                        
                        return (
                          <div className="mt-6 pt-6 border-t-2 border-gray-100">
                            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4 space-y-3">
                              <h5 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <div className="w-1 h-4 bg-green-600 rounded-full"></div>
                                유사도 근거
                              </h5>
                              {similarityReason ? (
                                <div className="space-y-3 text-lg text-gray-800 leading-loose tracking-wide whitespace-pre-line font-medium">
                                  {similarityReason}
                                </div>
                              ) : (
                                <div className="space-y-2.5 text-base text-gray-700 leading-relaxed">
                                  {weekendPercentDiff > 0 && (
                                    <div className="flex items-start gap-2.5">
                                      <div className="w-1.5 h-1.5 bg-green-600 rounded-full mt-2 flex-shrink-0"></div>
                                      <p className="flex-1">
                                        <span className="font-semibold text-gray-900">주말 매출이 주중 대비 {weekendPercentDiff.toFixed(1)}% 높게 집중</span>되어 주말 중심형 상권 특성을 공유합니다.
                                      </p>
                                    </div>
                                  )}
                                  {ratioDiff < 0.1 && (
                                    <div className="flex items-start gap-2.5">
                                      <div className="w-1.5 h-1.5 bg-green-600 rounded-full mt-2 flex-shrink-0"></div>
                                      <p className="flex-1">
                                        주말/주중 매출 비율이 거의 동일하여 (차이 {ratioDiff.toFixed(2)}) <span className="font-semibold text-gray-900">주중/주말 매출 패턴이 매우 유사</span>합니다.
                                      </p>
                                    </div>
                                  )}
                                  {(myWeekendWeekdayRatio > 1.1 && similarWeekendWeekdayRatio > 1.1) ? (
                                    <div className="flex items-start gap-2.5">
                                      <div className="w-1.5 h-1.5 bg-green-600 rounded-full mt-2 flex-shrink-0"></div>
                                      <p className="flex-1">
                                        두 매장 모두 주말 매출이 주중보다 높아 <span className="font-semibold text-gray-900">주말 중심형 상권 특성</span>을 공유합니다.
                                      </p>
                                    </div>
                                  ) : (myWeekendWeekdayRatio < 0.9 && similarWeekendWeekdayRatio < 0.9) ? (
                                    <div className="flex items-start gap-2.5">
                                      <div className="w-1.5 h-1.5 bg-green-600 rounded-full mt-2 flex-shrink-0"></div>
                                      <p className="flex-1">
                                        두 매장 모두 주중 매출이 주말보다 높아 <span className="font-semibold text-gray-900">주중 중심형 상권 특성</span>을 공유합니다.
                                      </p>
                                    </div>
                                  ) : (weekendRatioDiff < 0.05) ? (
                                    <div className="flex items-start gap-2.5">
                                      <div className="w-1.5 h-1.5 bg-green-600 rounded-full mt-2 flex-shrink-0"></div>
                                      <p className="flex-1">
                                        주말 매출 비중이 유사하여 (차이 {weekendRatioDiff.toFixed(2)}) 고객 유입 패턴이 일치합니다.
                                      </p>
                                    </div>
                                  ) : null}
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })()}
                    </div>
                  </div>
                </div>
              </div>
                </>
              )}

              {/* 유사매장 인기 상품 탭 */}
              {storeDetailTab === '인기상품' && (
                <>
              {/* 유사 매장 인기 상품 순위 제목 */}
              <div className="pt-2">
                <div className="mb-3 md:mb-4">
                  <div className="flex items-baseline gap-3 md:gap-4">
                    <div className="w-1 h-6 md:h-8 bg-green-600"></div>
                    <div>
                      <h3 className="text-lg md:text-xl font-bold text-gray-900 uppercase tracking-wide">
                        인기 상품 순위
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">매출 상위 상품을 보여드립니다</p>
                    </div>
                  </div>
                </div>

                {/* 대분류 탭 */}
                <div className="flex flex-wrap gap-2 mb-4 md:mb-6 border-b border-gray-200 pb-3">
                  {categories.map((category) => (
                    <button
                      key={category}
                      onClick={() => {
                        setSelectedCategory(category)
                        setSelectedMiddleCategory(null) // 대분류 변경 시 중분류 선택 초기화
                      }}
                      className={`px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap border-b-2 ${
                        selectedCategory === category
                          ? 'border-green-600 text-green-600 font-semibold'
                          : 'border-transparent text-gray-600 hover:text-green-600 hover:border-green-300'
                      }`}
                    >
                      {category}
                    </button>
                  ))}
                </div>
              </div>

              {/* 선택된 대분류의 상품 목록 */}
              {loadingDetail ? (
                <div className="text-center py-12">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mb-4"></div>
                  <p className="text-sm text-gray-600">데이터를 불러오는 중...</p>
                </div>
              ) : (
                <div className="flex flex-col md:flex-row gap-6">
                  {/* 왼쪽 필터 사이드바 */}
                  {selectedStore[selectedCategory] && (
                    <div className="w-full md:w-64 flex-shrink-0">
                      <div className="bg-white border border-gray-200 rounded-lg p-4 md:sticky md:top-4">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-sm font-bold text-gray-900">필터</h4>
                          <button
                            onClick={() => setSelectedMiddleCategory(null)}
                            className="text-xs text-gray-500 hover:text-gray-700"
                          >
                            초기화
                          </button>
                        </div>
                        <div className="space-y-2">
                          {(() => {
                            const categoryData = selectedStore[selectedCategory] as Record<string, string[]>
                            const allProducts = Object.values(categoryData).flat()
                            const totalCount = allProducts.length
                            
                            return (
                              <>
                                <label className="flex items-center gap-2 cursor-pointer py-2 hover:bg-gray-50 rounded px-2 -mx-2">
                                  <input
                                    type="radio"
                                    name="middleCategory"
                                    checked={selectedMiddleCategory === null}
                                    onChange={() => setSelectedMiddleCategory(null)}
                                    className="w-4 h-4 text-green-600 focus:ring-green-500"
                                  />
                                  <span className="text-sm text-gray-700">전체({totalCount})</span>
                                </label>
                                {Object.entries(categoryData).map(([subCategory, products]) => (
                                  <label key={subCategory} className="flex items-center gap-2 cursor-pointer py-2 hover:bg-gray-50 rounded px-2 -mx-2">
                                    <input
                                      type="radio"
                                      name="middleCategory"
                                      checked={selectedMiddleCategory === subCategory}
                                      onChange={() => setSelectedMiddleCategory(subCategory)}
                                      className="w-4 h-4 text-green-600 focus:ring-green-500"
                                    />
                                    <span className="text-sm text-gray-700">{subCategory}({products.length})</span>
                                  </label>
                                ))}
                              </>
                            )
                          })()}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 메인 컨텐츠 영역 */}
                  <div className="flex-1">
                    {selectedStore[selectedCategory] ? (
                      <div className={`${isMobile ? 'space-y-6' : 'space-y-8 md:space-y-10'}`}>
                        {Object.entries(selectedStore[selectedCategory] as Record<string, string[]>).map(
                          ([subCategory, products]) => {
                            // 중분류 필터 적용
                            if (selectedMiddleCategory !== null && selectedMiddleCategory !== subCategory) {
                              return null
                            }
                            
                            return (
                          <div key={subCategory} className={`${isMobile ? 'px-4' : 'space-y-4'}`}>
                            {/* 모바일 앱 스타일: 카테고리 제목 */}
                            {isMobile && (
                              <div className="flex items-center gap-2.5 mb-4 mt-2">
                                <div className="w-1 h-6 rounded-full bg-green-500"></div>
                                <h3 className="text-lg font-bold text-slate-900">{subCategory}</h3>
                              </div>
                            )}
                            
                            {/* 웹 스타일: 카테고리 제목 */}
                            {!isMobile && (
                              <div className="flex items-center gap-2">
                                <div className="w-1 h-6 rounded-full bg-green-500"></div>
                                <h3 className="text-base md:text-lg font-bold text-slate-900">{subCategory}</h3>
                              </div>
                            )}
                            
                            {/* 모바일 앱 스타일: 가로 스크롤 가능한 상품 리스트 */}
                            {isMobile ? (
                              <div 
                                className="flex gap-3 overflow-x-auto pb-3 scrollbar-hide" 
                                style={{ 
                                  scrollbarWidth: 'none', 
                                  msOverflowStyle: 'none',
                                  WebkitOverflowScrolling: 'touch',
                                  scrollSnapType: 'x mandatory',
                                  scrollPaddingLeft: '16px'
                                }}
                              >
                                {products.map((product, index) => {
                                  const itemId = `${selectedStore.store_code}-${subCategory}-${index}`
                                  const isVisible = visibleItems.has(itemId)
                                  const displayRank = index + 1
                                  const showBadge = displayRank <= 3
                                  const productInfo = productInfoMap.get(product)
                                  
                                  // PB 상품 체크
                                  const isPBProduct = product?.includes('PB)') || 
                                                    product?.includes('7-SELECT') || 
                                                    product?.includes('7SELECT') ||
                                                    product?.includes('PB ')
                                  
                                  return (
                                    <div
                                      key={itemId}
                                      ref={(el) => setItemRef(itemId, el)}
                                      data-item-id={itemId}
                                      onClick={() => handleProductClick(product)}
                                      className={`group cursor-pointer flex flex-col relative transition-all duration-200 flex-shrink-0 active:scale-95`}
                                      style={{ 
                                        width: 'calc(50vw - 24px)', 
                                        minWidth: 'calc(50vw - 24px)',
                                        scrollSnapAlign: 'start'
                                      }}
                                    >
                                      {isVisible ? (
                                        <>
                                          {/* 모바일 앱 스타일: 상품 이미지 */}
                                          <div className="relative aspect-square bg-white rounded-xl border border-gray-200 overflow-hidden flex items-center justify-center mb-3 shadow-sm">
                                            {/* 순위 배지 */}
                                            {showBadge && (
                                              <div className="absolute top-2 left-2 z-10">
                                                <div className="bg-green-500 w-7 h-7 flex items-center justify-center rounded shadow-sm">
                                                  <span className="text-white font-semibold text-xs">
                                                    {displayRank}
                                                  </span>
                                                </div>
                                              </div>
                                            )}
                                            
                                            {/* PB 상품 태그 */}
                                            {isPBProduct && (
                                              <div className="absolute top-2 right-2 z-10">
                                                <div className="bg-emerald-500 text-white px-2 py-1 rounded-full text-[10px] font-bold shadow-md">
                                                  seven only
                                                </div>
                                              </div>
                                            )}
                                            
                                            {productInfo?.item_img ? (
                                              <img
                                                src={productInfo.item_img}
                                                alt={product}
                                                className="w-full h-full object-contain max-w-full max-h-full p-3 transition-transform duration-300"
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
                                          
                                          {/* 모바일 앱 스타일: 상품 정보 */}
                                          <div className="flex flex-col space-y-1.5 mt-0">
                                            <h4 className="text-xs font-semibold text-slate-900 line-clamp-2 leading-tight">
                                              {product}
                                            </h4>
                                            
                                            {/* 가격 정보 */}
                                            {productInfo?.slem_amt !== null && productInfo?.slem_amt !== undefined && (
                                              <div className="pt-0.5">
                                                <span className="text-base font-bold text-slate-900">
                                                  {productInfo.slem_amt.toLocaleString()}원
                                                </span>
                                              </div>
                                            )}
                                          </div>
                                        </>
                                      ) : (
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
                            ) : (
                              /* 웹 스타일: 상품 그리드 */
                              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-5">
                                {products.map((product, index) => {
                                  const itemId = `${selectedStore.store_code}-${subCategory}-${index}`
                                  const isVisible = visibleItems.has(itemId)
                                  const displayRank = index + 1
                                  const showBadge = displayRank <= 3
                                  const productInfo = productInfoMap.get(product)
                                  
                                  // PB 상품 체크
                                  const isPBProduct = product?.includes('PB)') || 
                                                    product?.includes('7-SELECT') || 
                                                    product?.includes('7SELECT') ||
                                                    product?.includes('PB ')
                                  
                                  return (
                                    <div
                                      key={itemId}
                                      ref={(el) => setItemRef(itemId, el)}
                                      data-item-id={itemId}
                                      onClick={() => handleProductClick(product)}
                                      className="group cursor-pointer flex flex-col relative transition-all duration-300"
                                    >
                                      {isVisible ? (
                                        <>
                                          {/* 웹 스타일: 상품 이미지 */}
                                          <div className="relative aspect-square bg-white rounded-xl border border-gray-200 overflow-hidden flex items-center justify-center mb-3 shadow-sm">
                                            {/* 순위 배지 */}
                                            {showBadge && (
                                              <div className="absolute top-2 left-2 z-10">
                                                <div className="bg-green-500 w-7 h-7 flex items-center justify-center rounded shadow-sm">
                                                  <span className="text-white font-semibold text-xs">
                                                    {displayRank}
                                                  </span>
                                                </div>
                                              </div>
                                            )}
                                            
                                            {/* PB 상품 태그 */}
                                            {isPBProduct && (
                                              <div className="absolute top-2 right-2 z-10">
                                                <div className="bg-emerald-500 text-white px-2 py-1 rounded-full text-[10px] font-bold shadow-md">
                                                  seven only
                                                </div>
                                              </div>
                                            )}
                                            
                                            {productInfo?.item_img ? (
                                              <img
                                                src={productInfo.item_img}
                                                alt={product}
                                                className="w-full h-full object-contain max-w-full max-h-full p-4 md:p-6 transition-transform duration-300 group-hover:scale-105"
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

                                          {/* 웹 스타일: 상품 정보 */}
                                          <div className="flex flex-col space-y-2 mt-0">
                                            <h4 className="text-sm font-medium text-slate-900 line-clamp-2 leading-snug">
                                              {product}
                                            </h4>
                                            
                                            {/* 가격 정보 */}
                                            {productInfo?.slem_amt !== null && productInfo?.slem_amt !== undefined && (
                                              <div className="pt-1">
                                                <span className="text-lg font-bold text-slate-900">
                                                  {productInfo.slem_amt.toLocaleString()} 원
                                                </span>
                                              </div>
                                            )}
                                          </div>
                                        </>
                                      ) : (
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
                            )}
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-12 bg-gray-50 rounded-lg">
                        <p className="text-gray-600">해당 대분류의 상품 정보가 없습니다.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
                </>
              )}
            </div>

            {/* 모달 푸터 */}
            <div className="sticky bottom-0 bg-gray-50 border-t-2 border-gray-300 px-4 md:px-8 py-4 flex justify-end">
              <button
                onClick={() => setShowStoreDetailModal(false)}
                className="px-8 py-3 md:px-6 md:py-2.5 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white font-medium transition-colors rounded-lg"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 상품 상세 모달 */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-0 md:p-4">
          <div className="bg-white rounded-xl md:rounded-xl shadow-2xl w-full max-w-2xl max-h-[100vh] md:max-h-[90vh] overflow-hidden flex flex-col">
            {/* 헤더 */}
            <div className="sticky top-0 bg-white px-4 py-3 md:px-6 md:py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
              <h3 className="text-base md:text-lg font-bold text-gray-900">상품 정보</h3>
              <button
                onClick={() => setSelectedProduct(null)}
                className="w-10 h-10 md:w-8 md:h-8 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 active:bg-gray-200 transition-colors rounded-lg"
              >
                <svg className="w-6 h-6 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* 내용 */}
            <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-6">
              <div className="flex flex-col md:flex-row gap-6 md:gap-8">
                {/* 이미지 영역 */}
                {selectedProduct.item_img && (
                  <div className="flex-shrink-0 w-full md:w-80">
                    <div className="relative w-full aspect-square bg-white rounded-xl border border-gray-200 overflow-hidden flex items-center justify-center">
                      <img
                        src={selectedProduct.item_img}
                        alt={selectedProduct.item_nm}
                        className="w-full h-full object-contain p-4 md:p-6"
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
                    </div>
                  </div>
                )}

                {/* 상품 정보 영역 */}
                <div className="flex-1">
                  {/* 상품명 */}
                  <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-4 md:mb-6 leading-tight">
                    {selectedProduct.item_nm}
                  </h3>

                  {/* 가격 정보 */}
                  {(selectedProduct.slem_amt || selectedProduct.cpm_amt) && (
                    <div className="mb-4 md:mb-6 pb-4 md:pb-6 border-b border-gray-200">
                      {selectedProduct.slem_amt && (
                        <div className="mb-2">
                          <span className="text-2xl md:text-3xl font-bold text-green-600">
                            {selectedProduct.slem_amt.toLocaleString()}원
                          </span>
                        </div>
                      )}
                      {selectedProduct.cpm_amt && (
                        <div>
                          <span className="text-sm text-gray-500">원가: {selectedProduct.cpm_amt.toLocaleString()}원</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 태그 */}
                  {(selectedProduct.item_lrdv_nm || selectedProduct.item_mddv_nm || selectedProduct.item_smdv_nm) && (
                    <div className="mb-4 md:mb-6">
                      <h4 className="text-sm font-semibold text-gray-500 mb-2 md:mb-3">상품 분류</h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedProduct.item_lrdv_nm && (
                          <span className="px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded-lg font-medium">
                            {selectedProduct.item_lrdv_nm}
                          </span>
                        )}
                        {selectedProduct.item_mddv_nm && (
                          <span className="px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded-lg font-medium">
                            {selectedProduct.item_mddv_nm}
                          </span>
                        )}
                        {selectedProduct.item_smdv_nm && (
                          <span className="px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded-lg font-medium">
                            {selectedProduct.item_smdv_nm}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 상세 정보 */}
                  <div className="space-y-4">
                    {selectedProduct.item_lrdv_nm && (
                      <div>
                        <h4 className="text-xs font-semibold text-gray-500 mb-1">대분류</h4>
                        <p className="text-sm text-gray-900">{selectedProduct.item_lrdv_nm}</p>
                      </div>
                    )}
                    {selectedProduct.item_mddv_nm && (
                      <div>
                        <h4 className="text-xs font-semibold text-gray-500 mb-1">중분류</h4>
                        <p className="text-sm text-gray-900">{selectedProduct.item_mddv_nm}</p>
                      </div>
                    )}
                    {selectedProduct.item_smdv_nm && (
                      <div>
                        <h4 className="text-xs font-semibold text-gray-500 mb-1">소분류</h4>
                        <p className="text-sm text-gray-900">{selectedProduct.item_smdv_nm}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 푸터 */}
            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-4 md:px-6 py-4 flex justify-end">
              <button
                onClick={() => setSelectedProduct(null)}
                className="px-8 py-3 md:px-6 md:py-2.5 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white font-medium transition-colors rounded-lg"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

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
                  딥러닝을 통해 <span className="font-semibold">판매 패턴 분석</span>과 
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
                  <div className="bg-white border-l-4 border-green-600 p-3">
                    <p className="text-xs text-gray-700 leading-relaxed">
                      <span className="font-semibold text-gray-900">분석 결과:</span> 주요 카테고리가 전체 매출의 60% 이상을 차지하여 매장별 고객층의 구매 선호도를 명확히 반영
                    </p>
                  </div>
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
                  <div className="bg-white border-l-4 border-green-600 p-3">
                    <p className="text-xs text-gray-700 leading-relaxed">
                      <span className="font-semibold text-gray-900">분석 결과:</span> 상권 특성(근무형/야간형/주거형) 구분 및 타겟 고객층(직장인/학생/주부) 정확한 파악
                    </p>
                  </div>
                </div>
                
                <div className="bg-gray-50 border border-gray-300 p-5">
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-300">
                    <div className="w-2 h-2 bg-green-600"></div>
                    <h5 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
                      주말 대비 주중 매출 비율 분석
                    </h5>
                  </div>
                  <p className="text-sm text-gray-700 mb-3 leading-relaxed">
                    주말 대비 주중 매출 비율 분석
                  </p>
                  <div className="bg-white border-l-4 border-green-600 p-3">
                    <p className="text-xs text-gray-700 leading-relaxed">
                      <span className="font-semibold text-gray-900">분석 결과:</span> 주중 중심형/주말 중심형 매장 분류를 통한 발주 전략 차별화 가능
                    </p>
                  </div>
                </div>
                
                <div className="bg-gray-50 border border-gray-300 p-5">
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-300">
                    <div className="w-2 h-2 bg-green-600"></div>
                    <h5 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
                      유동인구 데이터
                    </h5>
                  </div>
                  <p className="text-sm text-gray-700 mb-3 leading-relaxed">
                    실시간 유동인구 정보와 방문객 패턴 분석을 통한 상권 특성 정확한 반영
                  </p>
                  <div className="bg-white border-l-4 border-green-600 p-3">
                    <p className="text-xs text-gray-700 leading-relaxed">
                      <span className="font-semibold text-gray-900">분석 결과:</span> 유동인구 데이터 결합을 통한 정밀한 유사도 분석 및 높은 신뢰도 확보
                    </p>
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

