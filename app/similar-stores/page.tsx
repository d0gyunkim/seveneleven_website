'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Layout from '@/components/Layout'
import KakaoMap from '@/components/KakaoMap'
import { supabase } from '@/lib/supabase'

interface SimilarStore {
  store_code: string
  store_nm: string
  rank: number
  address?: string
  latitude?: number
  longitude?: number
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
}

type CategoryType = '과자' | '냉장' | '맥주' | '면' | '미반' | '빵' | '음료'

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
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [showInfoModal, setShowInfoModal] = useState(false)
  const [showStoreDetailModal, setShowStoreDetailModal] = useState(false)
  const [storeDetailsByMonth, setStoreDetailsByMonth] = useState<Record<string, StoreDetail>>({})
  const [selectedMonth, setSelectedMonth] = useState<string>('')
  const [availableMonths, setAvailableMonths] = useState<string[]>([])
  const [timePatternTab, setTimePatternTab] = useState<'주중' | '주말'>('주중')
  // 현재 매장의 월별 데이터와 선택된 월
  const [currentStoreDataByMonth, setCurrentStoreDataByMonth] = useState<Record<string, any>>({})
  const [currentStoreAvailableMonths, setCurrentStoreAvailableMonths] = useState<string[]>([])
  const [currentSelectedMonth, setCurrentSelectedMonth] = useState<string>('')

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
        latitude,
        longitude,
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
        
        similarStoresData.push({
          store_code: String(similarStore.store_code),
          store_nm: similarStoreNm,
          rank: i + 1, // 순위는 1부터 시작
          address: similarStore['주소'] || similarStore.address || undefined,
          latitude,
          longitude,
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

  const fetchStoreDetail = async (storeCode: string) => {
    setLoadingDetail(true)
    try {
      const { data: storeData, error: storeError } = await supabase
        .from('매장마스터')
        .select('store_code, store_nm, 월기준, 과자, 냉장, 맥주, 면, 미반, 빵, 음료')
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

  const handleStoreClick = (storeCode: string) => {
    fetchStoreDetail(storeCode)
    setShowStoreDetailModal(true)
  }

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
          <div className="mb-8 md:mb-10">
            <div className="flex items-start justify-between mb-6">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-1 h-8 bg-gradient-to-b from-green-500 to-emerald-600 rounded-full"></div>
                  <div>
                    <h2 className="text-3xl md:text-4xl font-bold text-gray-900 tracking-tight">
                      유사 매장 분석
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">Similar Store Analysis</p>
                  </div>
                </div>
                <p className="text-base md:text-lg text-gray-600 leading-relaxed max-w-2xl">
                  AI 기반 판매 패턴 분석을 통해 상권 특성이 유사한 매장을 찾고, 발주 최적화 인사이트를 확인하세요
                </p>
              </div>
              <button
                onClick={() => setShowInfoModal(true)}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 rounded-xl transition-all duration-200 shadow-md hover:shadow-lg ml-4"
                title="유사 매장 분석 방법 알아보기"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span className="hidden md:inline">분석 방법</span>
              </button>
            </div>
            
            {/* 월별 탭 */}
            {currentStoreAvailableMonths.length > 0 && (
              <div className="flex items-center gap-3 flex-wrap bg-gradient-to-r from-gray-50 to-green-50/30 rounded-xl p-4 border border-gray-100">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-sm font-semibold text-gray-700">분석 기간:</span>
                </div>
                {currentStoreAvailableMonths.map((month) => (
                  <button
                    key={month}
                    onClick={() => handleCurrentMonthChange(month)}
                    className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 whitespace-nowrap ${
                      currentSelectedMonth === month
                        ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg transform scale-105'
                        : 'bg-white border-2 border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-green-400 hover:shadow-md'
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
            <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4 md:gap-6">
              {/* 왼쪽: 유사매장 목록 + 매장 정보 */}
              <div className="lg:order-1 space-y-4 md:space-y-6">
                {/* 유사매장 목록 */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden">
                  {/* 목록 헤더 */}
                  <div className="bg-gradient-to-r from-gray-50 to-green-50/50 border-b border-gray-200 px-5 py-4">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <h3 className="text-base font-bold text-gray-900">유사 매장 순위</h3>
                    </div>
                    <p className="text-xs text-gray-500">매장을 클릭하여 상세 분석 리포트 확인</p>
                  </div>
                  
                  {/* 스크롤 가능한 목록 */}
                  <div className="overflow-y-auto" style={{ maxHeight: selectedStore ? 'calc(100vh - 800px)' : 'calc(100vh - 300px)', minHeight: '300px' }}>
                    <div className="divide-y divide-gray-100">
                      {similarStores.map((store) => (
                        <div
                          key={store.store_code}
                          className={`px-5 py-4 cursor-pointer transition-all duration-200 ${
                            selectedStore?.store_code === store.store_code
                              ? 'bg-gradient-to-r from-green-50 to-emerald-50/50 border-l-4 border-green-500 shadow-sm'
                              : 'hover:bg-gray-50 hover:border-l-4 hover:border-gray-300'
                          }`}
                          onClick={() => handleStoreClick(store.store_code)}
                        >
                          <div className="flex items-start gap-3">
                              <span className={`flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-xl text-xs font-bold transition-all duration-200 ${
                              selectedStore?.store_code === store.store_code
                                ? 'bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-md'
                                : 'bg-green-100 text-green-600'
                            }`}>
                              {store.rank}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-semibold mb-1 ${
                                selectedStore?.store_code === store.store_code
                                  ? 'text-green-700'
                                  : 'text-gray-900'
                              }`}>
                                세븐일레븐 {store.store_nm}
                              </p>
                              {store.address && (
                                <p className="text-xs text-gray-500 line-clamp-1">
                                  {store.address}
                                </p>
                              )}
                            </div>
                            <svg
                              className={`w-4 h-4 flex-shrink-0 transition-transform duration-200 ${
                                selectedStore?.store_code === store.store_code
                                  ? 'text-green-500 rotate-90'
                                  : 'text-gray-400'
                              }`}
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
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* 오른쪽: 지도 (더 크게) */}
              <div className="lg:order-2">
                <div className="bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden h-full">
                  {/* 지도 헤더 */}
                  <div className="bg-gradient-to-r from-gray-50 to-green-50/50 border-b border-gray-200 px-5 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-md">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">유사 매장 위치</h3>
                        {currentSelectedMonth && (
                          <p className="text-xs text-gray-500 mt-0.5">기준 월: {currentSelectedMonth}</p>
                        )}
                      </div>
                    </div>
                    {currentSelectedMonth && (
                      <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl shadow-md">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="text-xs font-semibold">{currentSelectedMonth}</span>
                      </div>
                    )}
                  </div>
                  
                  {/* 지도 - 더 크게 */}
                  <div className="relative" style={{ height: 'calc(100vh - 200px)', minHeight: '600px' }}>
                    <KakaoMap 
                      stores={currentStoreInfo ? [currentStoreInfo, ...similarStores] : similarStores}
                      currentStoreName={currentStoreName}
                      className="w-full h-full"
                      selectedStore={selectedStore ? {
                        store_code: selectedStore.store_code,
                        store_nm: selectedStore.store_nm,
                        월기준: selectedMonth
                      } : null}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 정보 모달 */}
      {showInfoModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowInfoModal(false)}
        >
          <div
            className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 모달 헤더 */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900">유사 매장 산정 방법</h3>
              <button
                onClick={() => setShowInfoModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* 모달 내용 */}
            <div className="px-6 py-6 space-y-6">
              {/* 1. 유사 매장 선정 기준 */}
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-6 border-l-4 border-green-500">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-lg font-bold text-gray-900 mb-3">유사 매장 선정 기준</h4>
                    <p className="text-gray-700 leading-relaxed mb-4">
                      유사 매장은 <span className="font-semibold text-green-600">판매 추세 패턴 분석</span>과 <span className="font-semibold text-green-600">유동인구 데이터</span>를 종합하여 선정됩니다.
                    </p>
                    <div className="space-y-4">
                      <div className="bg-white rounded-lg p-4 shadow-sm">
                        <h5 className="font-semibold text-gray-900 mb-2">
                          판매 상품 패턴
                        </h5>
                        <p className="text-sm text-gray-600 mb-2">
                          전체 상품 판매량 대비 각 대분류 카테고리(과자, 냉장, 맥주, 면 등)의 판매량 비중을 분석합니다.
                        </p>
                        <p className="text-xs text-gray-500 italic">
                          매장별 대표 소비자층의 구매 취향을 반영하며, 핵심 카테고리는 전체 매출의 절반 이상을 차지합니다.
                        </p>
                      </div>
                      <div className="bg-white rounded-lg p-4 shadow-sm">
                        <h5 className="font-semibold text-gray-900 mb-2">
                          방문 시간대 패턴
                        </h5>
                        <p className="text-sm text-gray-600 mb-2">
                          주중/주말 × 시간대(심야/오전/오후/저녁)별 상품 판매량 비중을 분석합니다.
                        </p>
                        <p className="text-xs text-gray-500 italic">
                          근무형/야간형 등 상권 특성을 구분하며, 학생, 직장인, 야근 근무자 등 고객 유형을 파악합니다.
                        </p>
                      </div>
                      <div className="bg-white rounded-lg p-4 shadow-sm">
                        <h5 className="font-semibold text-gray-900 mb-2">
                          주말/주중 편중도
                        </h5>
                        <p className="text-sm text-gray-600 mb-2">
                          주말 상품 판매량 평균 대비 주중 상품 판매량 평균 비율을 계산합니다.
                        </p>
                        <p className="text-xs text-gray-500 italic">
                          오피스/주거/학교 등 상권 특성을 구분하며, 주중 중심형 또는 주말 중심형 매장을 분류합니다.
                        </p>
                      </div>
                      <div className="bg-white rounded-lg p-4 shadow-sm border-2 border-green-200">
                        <h5 className="font-semibold text-gray-900 mb-2">
                          유동인구 데이터
                        </h5>
                        <p className="text-sm text-gray-600">
                          방문객 수와 같은 유동인구 정보를 함께 고려하여 더욱 정확한 유사 매장을 선정합니다.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. 동적 재산출 이유 */}
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-6 border-l-4 border-green-500">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-lg font-bold text-gray-900 mb-3">동적 유사도 분석</h4>
                    <p className="text-gray-700 leading-relaxed mb-4">
                      <span className="font-semibold text-green-600">상권은 고정된 구조가 아니라 지속적으로 변화하는 동적 구조</span>입니다. 
                      동일한 매장이라도 계절별, 시기별로 상권 특성이 달라지기 때문에 유사 매장도 변합니다.
                    </p>
                    <div className="space-y-3">
                      <div className="bg-white rounded-lg p-4 shadow-sm">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-green-600 font-bold">예시 1</span>
                          <span className="text-sm text-gray-600">석촌동호수점</span>
                        </div>
                        <div className="grid md:grid-cols-2 gap-3 text-sm">
                          <div className="bg-green-50 rounded p-3 border border-green-100">
                            <div className="font-semibold text-gray-900 mb-1">1월 (관광 비수기)</div>
                            <div className="text-gray-600 text-xs space-y-1">
                              <div>• 대로변</div>
                              <div>• 상업형/생활형 특징</div>
                              <div>• 식당가</div>
                            </div>
                          </div>
                          <div className="bg-emerald-50 rounded p-3 border border-emerald-100">
                            <div className="font-semibold text-gray-900 mb-1">4월 (벚꽃 만개)</div>
                            <div className="text-gray-600 text-xs space-y-1">
                              <div>• 한강 주변</div>
                              <div>• 자연적 관광 수요 특징</div>
                              <div>• 공원가</div>
                            </div>
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-2 italic">→ 유사매장 Top 10의 교집합이 존재하지 않음</p>
                      </div>
                      <div className="bg-white rounded-lg p-4 shadow-sm">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-green-600 font-bold">예시 2</span>
                          <span className="text-sm text-gray-600">역삼만남점</span>
                        </div>
                        <div className="grid md:grid-cols-2 gap-3 text-sm">
                          <div className="bg-green-50 rounded p-3 border border-green-100">
                            <div className="font-semibold text-gray-900 mb-1">12월 (입시 종료)</div>
                            <div className="text-gray-600 text-xs space-y-1">
                              <div>• 유흥가</div>
                              <div>• 역삼역 주변</div>
                              <div>• 환승역 앞</div>
                            </div>
                          </div>
                          <div className="bg-emerald-50 rounded p-3 border border-emerald-100">
                            <div className="font-semibold text-gray-900 mb-1">7월 (n수생 유입)</div>
                            <div className="text-gray-600 text-xs space-y-1">
                              <div>• 대학 정문</div>
                              <div>• 대학 상권</div>
                              <div>• 대학가</div>
                            </div>
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-2 italic">→ 유사매장 Top 10의 교집합이 존재하지 않음</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. 매주 재계산 이유 */}
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-6 border-l-4 border-green-500">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-lg font-bold text-gray-900 mb-3">Rolling Window 기법</h4>
                    <p className="text-gray-700 leading-relaxed mb-4">
                      상권은 여러 요인에 따라 점진적으로 변화하므로, <span className="font-semibold text-green-600">최근 1개월 데이터를 유지하며 1주 단위로 갱신</span>하는 
                      Rolling Window를 통해 변화를 연속적이고 유연하게 반영합니다.
                    </p>
                    <div className="bg-white rounded-lg p-4 shadow-sm mb-3">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        <span className="text-sm font-semibold text-gray-900">기준 구간: 최근 1개월 데이터</span>
                      </div>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        <span className="text-sm font-semibold text-gray-900">계산 주기: 1주 단위로 갱신</span>
                      </div>
                      <div className="text-sm text-gray-600 space-y-2">
                        <p>• 매주 새로운 주를 추가하고 가장 오래된 주를 제거하여 최신 4주 데이터 유지</p>
                        <p>• 해당 구간의 판매 비중·시간대 추세로 유사 매장 유사도 재계산</p>
                      </div>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                      <p className="text-sm text-gray-700 leading-relaxed">
                        <strong className="text-green-600">Rolling Window 기반</strong>으로 한 달 단위의 데이터를 순차적으로 갱신하며, 
                        시기별 판매 패턴 변화를 반영하여 상권의 점진적·유동적 변화를 효과적으로 포착합니다.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 모달 푸터 */}
            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end">
              <button
                onClick={() => setShowInfoModal(false)}
                className="px-6 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors font-medium"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 매장 상세 정보 모달 */}
      {showStoreDetailModal && selectedStore && availableMonths.length > 0 && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowStoreDetailModal(false)}
        >
          <div
            className="bg-white rounded-lg max-w-7xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 모달 헤더 */}
            <div className="sticky top-0 bg-gradient-to-r from-white to-gray-50/50 border-b-2 border-gray-200 px-8 py-6 z-10 shadow-sm">
              <div className="flex items-start justify-between mb-5">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-1 h-8 bg-gradient-to-b from-green-500 to-emerald-600 rounded-full"></div>
                    <div>
                      <h3 className="text-2xl font-bold text-gray-900">
                        {selectedMonth || ''} {selectedStore.store_nm || ''}
                      </h3>
                      <p className="text-sm text-gray-500 mt-0.5">유사도 분석 리포트</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-sm font-bold rounded-xl shadow-md flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    높은 신뢰도
                  </div>
                  <button
                    onClick={() => setShowStoreDetailModal(false)}
                    className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all duration-200"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              {/* 월별 탭 */}
              {availableMonths.length > 0 && (
                <div className="flex items-center gap-2 bg-white/80 rounded-xl p-2">
                  {availableMonths.map((month) => (
                    <button
                      key={month}
                      onClick={() => {
                        console.log('월 변경:', month, '데이터:', storeDetailsByMonth[month])
                        setSelectedMonth(month)
                        setSelectedStore(storeDetailsByMonth[month])
                        setSelectedCategory('과자')
                      }}
                      className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 whitespace-nowrap ${
                        selectedMonth === month
                          ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-md'
                          : 'bg-transparent text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {month}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 모달 내용 */}
            <div className="px-8 py-8">
              {/* 유사도 분석 섹션 - 세 개의 패널 나란히 */}
              <div className="mb-10 pb-10 border-b border-gray-200">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                  {/* 판매 패턴 유사도 */}
                  <div className="bg-gradient-to-br from-white to-green-50/30 rounded-2xl p-6 border-2 border-gray-100 shadow-lg hover:shadow-xl transition-all duration-300 flex flex-col">
                    <div className="mb-5 flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center shadow-md">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                          </svg>
                        </div>
                        <h4 className="text-base font-bold text-gray-900">판매 패턴</h4>
                      </div>
                      <div className="text-right">
                        <span className="text-2xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">92.1%</span>
                        <div className="text-xs text-gray-600 font-medium">매우 유사</div>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-gray-600">카테고리 비중 일치도</span>
                          <span className="text-xs font-semibold text-gray-700">92.1%</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                          <div className="bg-gradient-to-r from-green-500 to-emerald-500 h-2 rounded-full transition-all duration-300" style={{ width: '92.1%' }}></div>
                        </div>
                      </div>
                      <div className="pt-4 border-t border-gray-100">
                        <p className="text-xs font-semibold text-gray-700 mb-3">주요 카테고리 비교</p>
                        <div className="space-y-3">
                          <div>
                            <div className="flex items-center justify-between mb-1.5 gap-2">
                              <span className="text-xs text-gray-700 flex-shrink-0">과자</span>
                              <span className="text-[10px] font-semibold text-gray-900 text-right whitespace-nowrap">내 매장 24.3% | 유사매장 25.1%</span>
                            </div>
                            <div className="flex gap-2">
                              <div className="flex-1 bg-green-100 rounded h-2.5">
                                <div className="bg-green-500 h-2.5 rounded" style={{ width: '24.3%' }}></div>
                              </div>
                              <div className="flex-1 bg-emerald-100 rounded h-2.5">
                                <div className="bg-emerald-500 h-2.5 rounded" style={{ width: '25.1%' }}></div>
                              </div>
                            </div>
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-1.5 gap-2">
                              <span className="text-xs text-gray-700 flex-shrink-0">냉장</span>
                              <span className="text-[10px] font-semibold text-gray-900 text-right whitespace-nowrap">내 매장 18.7% | 유사매장 19.2%</span>
                            </div>
                            <div className="flex gap-2">
                              <div className="flex-1 bg-green-100 rounded h-2.5">
                                <div className="bg-green-500 h-2.5 rounded" style={{ width: '18.7%' }}></div>
                              </div>
                              <div className="flex-1 bg-emerald-100 rounded h-2.5">
                                <div className="bg-emerald-500 h-2.5 rounded" style={{ width: '19.2%' }}></div>
                              </div>
                            </div>
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-1.5 gap-2">
                              <span className="text-xs text-gray-700 flex-shrink-0">음료</span>
                              <span className="text-[10px] font-semibold text-gray-900 text-right whitespace-nowrap">내 매장 22.1% | 유사매장 21.8%</span>
                            </div>
                            <div className="flex gap-2">
                              <div className="flex-1 bg-green-100 rounded h-2.5">
                                <div className="bg-green-500 h-2.5 rounded" style={{ width: '22.1%' }}></div>
                              </div>
                              <div className="flex-1 bg-emerald-100 rounded h-2.5">
                                <div className="bg-emerald-500 h-2.5 rounded" style={{ width: '21.8%' }}></div>
                              </div>
                            </div>
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-1.5 gap-2">
                              <span className="text-xs text-gray-700 flex-shrink-0">면</span>
                              <span className="text-[10px] font-semibold text-gray-900 text-right whitespace-nowrap">내 매장 12.4% | 유사매장 12.8%</span>
                            </div>
                            <div className="flex gap-2">
                              <div className="flex-1 bg-green-100 rounded h-2.5">
                                <div className="bg-green-500 h-2.5 rounded" style={{ width: '12.4%' }}></div>
                              </div>
                              <div className="flex-1 bg-emerald-100 rounded h-2.5">
                                <div className="bg-emerald-500 h-2.5 rounded" style={{ width: '12.8%' }}></div>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="mt-4 p-3 bg-gradient-to-r from-green-50 to-emerald-50/50 rounded-lg border border-green-200/50">
                          <div className="flex items-start gap-2">
                            <svg className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <p className="text-xs text-gray-700 leading-relaxed">
                              <span className="font-bold text-green-700">발주 최적화:</span> 이 매장의 카테고리별 판매 비중을 참고하여 
                              발주량을 조정하시면 재고 회전율을 높일 수 있습니다.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 시간대 패턴 유사도 */}
                  <div className="bg-gradient-to-br from-white to-blue-50/30 rounded-2xl p-6 border-2 border-gray-100 shadow-lg hover:shadow-xl transition-all duration-300 flex flex-col">
                    <div className="mb-5 flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-lg flex items-center justify-center shadow-md">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div>
                          <h4 className="text-base font-bold text-gray-900">시간대 패턴</h4>
                          <p className="text-xs text-gray-500 mt-0.5">고객 유입 시간</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">88.5%</span>
                        <div className="text-xs text-gray-600 font-medium">매우 유사</div>
                      </div>
                    </div>
                    
                    {/* 주중/주말 탭 */}
                    <div className="flex gap-2 mb-4">
                      <button
                        onClick={() => setTimePatternTab('주중')}
                        className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                          timePatternTab === '주중'
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        주중
                      </button>
                      <button
                        onClick={() => setTimePatternTab('주말')}
                        className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                          timePatternTab === '주말'
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        주말
                      </button>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-gray-600">{timePatternTab} 시간대별 분포 일치도</span>
                          <span className="text-xs font-semibold text-gray-700">88.5%</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                          <div className="bg-gradient-to-r from-blue-500 to-cyan-500 h-2 rounded-full transition-all duration-300" style={{ width: '88.5%' }}></div>
                        </div>
                      </div>
                      <div className="pt-4 border-t border-gray-100">
                        <p className="text-xs font-semibold text-gray-700 mb-3">시간대별 매출 비중</p>
                        <div className="grid grid-cols-2 gap-3 mb-4">
                          {/* 내 매장 파이차트 */}
                          <div className="flex flex-col items-center">
                            <h5 className="text-xs font-semibold text-gray-700 mb-2">내 매장</h5>
                            <div className="relative">
                              <svg width="120" height="120" viewBox="0 0 120 120" className="mb-2">
                                <defs>
                                  <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
                                    <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.2"/>
                                  </filter>
                                </defs>
                                {/* 오전 (28.2%) - 파란색 */}
                                <path
                                  d={`M 60 60 L ${60 + 45 * Math.cos((-90) * Math.PI / 180)} ${60 + 45 * Math.sin((-90) * Math.PI / 180)} A 45 45 0 ${28.2 * 3.6 > 180 ? '1' : '0'} 1 ${60 + 45 * Math.cos((-90 + 28.2 * 3.6) * Math.PI / 180)} ${60 + 45 * Math.sin((-90 + 28.2 * 3.6) * Math.PI / 180)} Z`}
                                  fill="#3b82f6"
                                  filter="url(#shadow)"
                                />
                                {/* 오후 (35.4%) - 청록색 */}
                                <path
                                  d={`M 60 60 L ${60 + 45 * Math.cos((-90 + 28.2 * 3.6) * Math.PI / 180)} ${60 + 45 * Math.sin((-90 + 28.2 * 3.6) * Math.PI / 180)} A 45 45 0 ${35.4 * 3.6 > 180 ? '1' : '0'} 1 ${60 + 45 * Math.cos((-90 + (28.2 + 35.4) * 3.6) * Math.PI / 180)} ${60 + 45 * Math.sin((-90 + (28.2 + 35.4) * 3.6) * Math.PI / 180)} Z`}
                                  fill="#06b6d4"
                                  filter="url(#shadow)"
                                />
                                {/* 저녁 (36.4%) - 남색 */}
                                <path
                                  d={`M 60 60 L ${60 + 45 * Math.cos((-90 + (28.2 + 35.4) * 3.6) * Math.PI / 180)} ${60 + 45 * Math.sin((-90 + (28.2 + 35.4) * 3.6) * Math.PI / 180)} A 45 45 0 ${36.4 * 3.6 > 180 ? '1' : '0'} 1 ${60 + 45 * Math.cos((-90 + (28.2 + 35.4 + 36.4) * 3.6) * Math.PI / 180)} ${60 + 45 * Math.sin((-90 + (28.2 + 35.4 + 36.4) * 3.6) * Math.PI / 180)} Z`}
                                  fill="#1e40af"
                                  filter="url(#shadow)"
                                />
                                {/* 텍스트 레이블 */}
                                <text
                                  x={60 + 20 * Math.cos((-90 + 28.2 * 3.6 / 2) * Math.PI / 180)}
                                  y={60 + 20 * Math.sin((-90 + 28.2 * 3.6 / 2) * Math.PI / 180)}
                                  textAnchor="middle"
                                  dominantBaseline="middle"
                                  fill="white"
                                  fontSize="10"
                                  fontWeight="bold"
                                  className="drop-shadow-lg"
                                >
                                  28.2%
                                </text>
                                <text
                                  x={60 + 20 * Math.cos((-90 + 28.2 * 3.6 + 35.4 * 3.6 / 2) * Math.PI / 180)}
                                  y={60 + 20 * Math.sin((-90 + 28.2 * 3.6 + 35.4 * 3.6 / 2) * Math.PI / 180)}
                                  textAnchor="middle"
                                  dominantBaseline="middle"
                                  fill="white"
                                  fontSize="10"
                                  fontWeight="bold"
                                  className="drop-shadow-lg"
                                >
                                  35.4%
                                </text>
                                <text
                                  x={60 + 20 * Math.cos((-90 + (28.2 + 35.4) * 3.6 + 36.4 * 3.6 / 2) * Math.PI / 180)}
                                  y={60 + 20 * Math.sin((-90 + (28.2 + 35.4) * 3.6 + 36.4 * 3.6 / 2) * Math.PI / 180)}
                                  textAnchor="middle"
                                  dominantBaseline="middle"
                                  fill="white"
                                  fontSize="10"
                                  fontWeight="bold"
                                  className="drop-shadow-lg"
                                >
                                  36.4%
                                </text>
                              </svg>
                            </div>
                            <div className="space-y-1 text-center w-full">
                              <div className="flex items-center justify-center gap-1.5">
                                <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0"></div>
                                <span className="text-[10px] text-gray-600 whitespace-nowrap">오전 28.2%</span>
                              </div>
                              <div className="flex items-center justify-center gap-1.5">
                                <div className="w-2 h-2 rounded-full bg-cyan-500 flex-shrink-0"></div>
                                <span className="text-[10px] text-gray-600 whitespace-nowrap">오후 35.4%</span>
                              </div>
                              <div className="flex items-center justify-center gap-1.5">
                                <div className="w-2 h-2 rounded-full bg-blue-800 flex-shrink-0"></div>
                                <span className="text-[10px] text-gray-600 whitespace-nowrap">저녁 36.4%</span>
                              </div>
                            </div>
                          </div>

                          {/* 유사매장 파이차트 */}
                          <div className="flex flex-col items-center">
                            <h5 className="text-xs font-semibold text-gray-700 mb-2">유사매장</h5>
                            <div className="relative">
                              <svg width="120" height="120" viewBox="0 0 120 120" className="mb-2">
                                <defs>
                                  <filter id="shadow2" x="-50%" y="-50%" width="200%" height="200%">
                                    <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.2"/>
                                  </filter>
                                </defs>
                                {/* 오전 (27.5%) */}
                                <path
                                  d={`M 60 60 L ${60 + 45 * Math.cos((-90) * Math.PI / 180)} ${60 + 45 * Math.sin((-90) * Math.PI / 180)} A 45 45 0 ${27.5 * 3.6 > 180 ? '1' : '0'} 1 ${60 + 45 * Math.cos((-90 + 27.5 * 3.6) * Math.PI / 180)} ${60 + 45 * Math.sin((-90 + 27.5 * 3.6) * Math.PI / 180)} Z`}
                                  fill="#3b82f6"
                                  filter="url(#shadow2)"
                                />
                                {/* 오후 (36.1%) */}
                                <path
                                  d={`M 60 60 L ${60 + 45 * Math.cos((-90 + 27.5 * 3.6) * Math.PI / 180)} ${60 + 45 * Math.sin((-90 + 27.5 * 3.6) * Math.PI / 180)} A 45 45 0 ${36.1 * 3.6 > 180 ? '1' : '0'} 1 ${60 + 45 * Math.cos((-90 + (27.5 + 36.1) * 3.6) * Math.PI / 180)} ${60 + 45 * Math.sin((-90 + (27.5 + 36.1) * 3.6) * Math.PI / 180)} Z`}
                                  fill="#06b6d4"
                                  filter="url(#shadow2)"
                                />
                                {/* 저녁 (36.4%) */}
                                <path
                                  d={`M 60 60 L ${60 + 45 * Math.cos((-90 + (27.5 + 36.1) * 3.6) * Math.PI / 180)} ${60 + 45 * Math.sin((-90 + (27.5 + 36.1) * 3.6) * Math.PI / 180)} A 45 45 0 ${36.4 * 3.6 > 180 ? '1' : '0'} 1 ${60 + 45 * Math.cos((-90 + (27.5 + 36.1 + 36.4) * 3.6) * Math.PI / 180)} ${60 + 45 * Math.sin((-90 + (27.5 + 36.1 + 36.4) * 3.6) * Math.PI / 180)} Z`}
                                  fill="#1e40af"
                                  filter="url(#shadow2)"
                                />
                                {/* 텍스트 레이블 */}
                                <text
                                  x={60 + 20 * Math.cos((-90 + 27.5 * 3.6 / 2) * Math.PI / 180)}
                                  y={60 + 20 * Math.sin((-90 + 27.5 * 3.6 / 2) * Math.PI / 180)}
                                  textAnchor="middle"
                                  dominantBaseline="middle"
                                  fill="white"
                                  fontSize="10"
                                  fontWeight="bold"
                                  className="drop-shadow-lg"
                                >
                                  27.5%
                                </text>
                                <text
                                  x={60 + 20 * Math.cos((-90 + 27.5 * 3.6 + 36.1 * 3.6 / 2) * Math.PI / 180)}
                                  y={60 + 20 * Math.sin((-90 + 27.5 * 3.6 + 36.1 * 3.6 / 2) * Math.PI / 180)}
                                  textAnchor="middle"
                                  dominantBaseline="middle"
                                  fill="white"
                                  fontSize="10"
                                  fontWeight="bold"
                                  className="drop-shadow-lg"
                                >
                                  36.1%
                                </text>
                                <text
                                  x={60 + 20 * Math.cos((-90 + (27.5 + 36.1) * 3.6 + 36.4 * 3.6 / 2) * Math.PI / 180)}
                                  y={60 + 20 * Math.sin((-90 + (27.5 + 36.1) * 3.6 + 36.4 * 3.6 / 2) * Math.PI / 180)}
                                  textAnchor="middle"
                                  dominantBaseline="middle"
                                  fill="white"
                                  fontSize="10"
                                  fontWeight="bold"
                                  className="drop-shadow-lg"
                                >
                                  36.4%
                                </text>
                              </svg>
                            </div>
                            <div className="space-y-1 text-center w-full">
                              <div className="flex items-center justify-center gap-1.5">
                                <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0"></div>
                                <span className="text-[10px] text-gray-600 whitespace-nowrap">오전 27.5%</span>
                              </div>
                              <div className="flex items-center justify-center gap-1.5">
                                <div className="w-2 h-2 rounded-full bg-cyan-500 flex-shrink-0"></div>
                                <span className="text-[10px] text-gray-600 whitespace-nowrap">오후 36.1%</span>
                              </div>
                              <div className="flex items-center justify-center gap-1.5">
                                <div className="w-2 h-2 rounded-full bg-blue-800 flex-shrink-0"></div>
                                <span className="text-[10px] text-gray-600 whitespace-nowrap">저녁 36.4%</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="mt-4 p-3 bg-gradient-to-r from-blue-50 to-cyan-50/50 rounded-lg border border-blue-200/50">
                          <div className="flex items-start gap-2">
                            <svg className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <p className="text-xs text-gray-700 leading-relaxed">
                              <span className="font-bold text-blue-700">발주 시점:</span> 저녁 시간대 매출 비중이 높으므로 
                              이 시간대 재고 확보에 중점을 두시면 매출 극대화가 가능합니다.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 주중/주말 패턴 유사도 */}
                  <div className="bg-gradient-to-br from-white to-purple-50/30 rounded-2xl p-6 border-2 border-gray-100 shadow-lg hover:shadow-xl transition-all duration-300 flex flex-col">
                    <div className="mb-5 flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg flex items-center justify-center shadow-md">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div>
                          <h4 className="text-base font-bold text-gray-900">주중/주말 패턴</h4>
                          <p className="text-xs text-gray-500 mt-0.5">요일별 판매 패턴</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">85.2%</span>
                        <div className="text-xs text-gray-600 font-medium">유사</div>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-gray-600">주중/주말 비율 일치도</span>
                          <span className="text-xs font-semibold text-gray-700">85.2%</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                          <div className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-300" style={{ width: '85.2%' }}></div>
                        </div>
                      </div>
                      <div className="pt-4 border-t border-gray-100">
                        <p className="text-xs font-semibold text-gray-700 mb-3">요일별 판매 패턴 비교</p>
                        <div className="space-y-3 mb-4">
                          {/* 주중 바 차트 */}
                          <div className="flex items-end justify-center gap-3">
                            <div className="flex flex-col items-center gap-1 min-w-[60px]">
                              <div className="text-[10px] font-semibold text-gray-900">내 매장</div>
                              <div className="w-10 h-14 bg-green-100 rounded-t relative flex items-end">
                                <div className="w-full bg-green-500 rounded-t" style={{ height: '56.9%' }}></div>
                              </div>
                              <div className="text-[10px] font-semibold text-gray-900">56.9</div>
                              <div className="text-[10px] text-gray-600">주중</div>
                            </div>
                            <div className="flex flex-col items-center gap-1 min-w-[60px]">
                              <div className="text-[10px] font-semibold text-gray-900">유사매장</div>
                              <div className="w-10 h-14 bg-emerald-100 rounded-t relative flex items-end">
                                <div className="w-full bg-emerald-500 rounded-t" style={{ height: '56.7%' }}></div>
                              </div>
                              <div className="text-[10px] font-semibold text-gray-900">56.7</div>
                              <div className="text-[10px] text-gray-600">주중</div>
                            </div>
                          </div>
                          {/* 주말 바 차트 */}
                          <div className="flex items-end justify-center gap-3">
                            <div className="flex flex-col items-center gap-1 min-w-[60px]">
                              <div className="text-[10px] font-semibold text-gray-900">내 매장</div>
                              <div className="w-10 h-14 bg-green-100 rounded-t relative flex items-end">
                                <div className="w-full bg-green-500 rounded-t" style={{ height: '43.1%' }}></div>
                              </div>
                              <div className="text-[10px] font-semibold text-gray-900">43.1</div>
                              <div className="text-[10px] text-gray-600">주말</div>
                            </div>
                            <div className="flex flex-col items-center gap-1 min-w-[60px]">
                              <div className="text-[10px] font-semibold text-gray-900">유사매장</div>
                              <div className="w-10 h-14 bg-emerald-100 rounded-t relative flex items-end">
                                <div className="w-full bg-emerald-500 rounded-t" style={{ height: '43.8%' }}></div>
                              </div>
                              <div className="text-[10px] font-semibold text-gray-900">43.8</div>
                              <div className="text-[10px] text-gray-600">주말</div>
                            </div>
                          </div>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3 mb-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-gray-600">요일별 편차</span>
                            <span className="text-xs font-semibold text-gray-900">낮음</span>
                          </div>
                          <p className="text-xs text-gray-600">
                            요일별 매출 편차가 작아 안정적인 발주 패턴 유지 가능
                          </p>
                        </div>
                        <div className="mt-4 p-3 bg-gradient-to-r from-purple-50 to-pink-50/50 rounded-lg border border-purple-200/50">
                          <div className="flex items-start gap-2">
                            <svg className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <p className="text-xs text-gray-700 leading-relaxed">
                              <span className="font-bold text-purple-700">주간 발주 전략:</span> 주중과 주말 매출 비율을 참고하여 
                              요일별 발주량을 차별화하시면 재고 최적화와 매출 증대를 동시에 달성할 수 있습니다.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 유사 매장 인기 상품 순위 제목 */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-1 h-8 bg-gradient-to-b from-green-500 to-emerald-600 rounded-full"></div>
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900 tracking-tight">
                      인기 상품 순위
                    </h3>
                    <p className="text-sm text-gray-500 mt-0.5">유사 매장에서 판매량이 높은 상품</p>
                  </div>
                </div>
                <button
                  className="flex items-center gap-2 px-4 py-2.5 bg-white border-2 border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 hover:border-green-400 hover:shadow-md transition-all duration-200"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                  내 매장 상품 제외
                </button>
              </div>

              {/* 대분류 탭 */}
              <div className="flex flex-wrap gap-3 mb-8 overflow-x-auto pb-2 bg-gradient-to-r from-gray-50 to-green-50/30 rounded-xl p-3">
                {categories.map((category) => (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 whitespace-nowrap ${
                      selectedCategory === category
                        ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg transform scale-105'
                        : 'bg-white border-2 border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-green-400 hover:shadow-md'
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>

              {/* 선택된 대분류의 상품 목록 */}
              {loadingDetail ? (
                <div className="text-center py-12">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mb-4"></div>
                  <p className="text-sm text-gray-600">데이터를 불러오는 중...</p>
                </div>
              ) : (
                <div>
                  {selectedStore[selectedCategory] ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {Object.entries(selectedStore[selectedCategory] as Record<string, string[]>).map(
                        ([subCategory, products]) => (
                          <div
                            key={subCategory}
                            className="bg-white border-l-4 border-green-500 rounded-lg p-4 hover:shadow-md transition-shadow"
                          >
                            <div className="flex items-center justify-between mb-3">
                              <h3 className="text-sm md:text-base font-semibold text-gray-900">
                                {subCategory}
                              </h3>
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                판매순 상위
                              </span>
                            </div>
                            <div className="space-y-2">
                              {products.map((product, index) => (
                                <div
                                  key={index}
                                  className="flex items-start gap-2 text-xs md:text-sm text-gray-700"
                                >
                                  <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full bg-green-50 text-green-600 font-semibold text-xs">
                                    {index + 1}
                                  </span>
                                  <span className="flex-1 leading-tight">{product}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-12 bg-gray-50 rounded-lg">
                      <p className="text-gray-600">해당 대분류의 상품 정보가 없습니다.</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 모달 푸터 */}
            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end">
              <button
                onClick={() => setShowStoreDetailModal(false)}
                className="px-6 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors font-medium"
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

