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
  const [storeDetailsByMonth, setStoreDetailsByMonth] = useState<Record<string, StoreDetail>>({})
  const [selectedMonth, setSelectedMonth] = useState<string>('')
  const [availableMonths, setAvailableMonths] = useState<string[]>([])
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
        <div className="max-w-7xl mx-auto px-3 md:px-4 py-4 md:py-6">
          {/* 헤더 */}
          <div className="mb-8 md:mb-10">
            <div className="flex items-start justify-between mb-6">
              <div className="flex-1">
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2 tracking-tight">
                  유사 매장 순위
                </h2>
                <p className="text-base md:text-lg text-gray-600 leading-relaxed">
                  판매 패턴과 상권 특성이 유사한 매장들을 확인하세요
                </p>
              </div>
              <button
                onClick={() => setShowInfoModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 hover:text-green-600 hover:bg-green-50 rounded-lg transition-all duration-200 border border-gray-200 hover:border-green-300 ml-4"
                title="유사 매장 산정 방법 알아보기"
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
                <span className="hidden md:inline">산정 방법</span>
              </button>
            </div>
            
            {/* 월별 탭 */}
            {currentStoreAvailableMonths.length > 0 && (
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-sm font-medium text-gray-600">분석 기준 월:</span>
                {currentStoreAvailableMonths.map((month) => (
                  <button
                    key={month}
                    onClick={() => handleCurrentMonthChange(month)}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 whitespace-nowrap shadow-sm ${
                      currentSelectedMonth === month
                        ? 'bg-green-500 text-white shadow-md scale-105'
                        : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-green-300'
                    }`}
                  >
                    {month}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 유사매장 목록 */}
          {similarStores.length === 0 ? (
            <div className="text-center py-16 bg-gray-50 rounded-xl border border-gray-200">
              <p className="text-gray-500 text-base">유사 매장 정보가 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {similarStores.map((store) => (
                <div
                  key={store.store_code}
                  className={`bg-white border-2 rounded-xl p-5 cursor-pointer transition-all duration-200 ${
                    selectedStore?.store_code === store.store_code
                      ? 'border-green-500 bg-green-50 shadow-lg'
                      : 'border-gray-200 hover:border-green-300 hover:shadow-md'
                  }`}
                  onClick={() => handleStoreClick(store.store_code)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-green-100 text-green-600 font-bold text-sm">
                          {store.rank}
                        </span>
                        <p className="text-base md:text-lg text-gray-900 font-semibold">
                          세븐일레븐 {store.store_nm}
                        </p>
                      </div>
                      <p className="text-sm text-gray-500 ml-11">
                        클릭하여 매장 상세 정보 확인
                      </p>
                    </div>
                    <div className="ml-4">
                      <svg
                        className={`w-6 h-6 transition-transform duration-200 ${
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
                </div>
              ))}
            </div>
          )}

          {/* 지도 섹션 */}
          {similarStores.length > 0 && (
            <div className="mt-10 md:mt-12">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">
                  유사 매장 위치 지도
                </h3>
                {currentSelectedMonth && (
                  <div className="flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 rounded-lg">
                    <span className="text-sm font-medium text-gray-600">분석 기준:</span>
                    <span className="text-base font-bold text-green-600">{currentSelectedMonth}</span>
                  </div>
                )}
              </div>
              <KakaoMap 
                stores={currentStoreInfo ? [currentStoreInfo, ...similarStores] : similarStores}
                currentStoreName={currentStoreName}
                className="w-full"
                selectedStore={selectedStore ? {
                  store_code: selectedStore.store_code,
                  store_nm: selectedStore.store_nm,
                  월기준: selectedMonth
                } : null}
              />
            </div>
          )}

          {/* 매장 상세 정보 */}
          {selectedStore && availableMonths.length > 0 && (
            <div className="mt-10 md:mt-14">
              {/* 상세 정보 헤더 */}
              <div className="mb-8 md:mb-10">
                <div className="flex items-center justify-between mb-8">
                  {/* 왼쪽: 월 + 매장명 */}
                  <div>
                    <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-2 tracking-tight">
                      {selectedMonth || ''} {selectedStore.store_nm || ''} 정보
                    </h2>
                    <p className="text-sm text-gray-500 font-medium tracking-wide">Top Start</p>
                  </div>
                  
                  {/* 오른쪽: 월별 탭 */}
                  {availableMonths.length > 0 && (
                    <div className="flex items-center gap-2">
                      {availableMonths.map((month) => (
                        <button
                          key={month}
                          onClick={() => {
                            console.log('월 변경:', month, '데이터:', storeDetailsByMonth[month])
                            setSelectedMonth(month)
                            setSelectedStore(storeDetailsByMonth[month])
                            setSelectedCategory('과자') // 월 변경 시 카테고리도 초기화
                          }}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                            selectedMonth === month
                              ? 'bg-green-500 text-white'
                              : 'text-gray-500 hover:text-gray-700'
                          }`}
                        >
                          {month}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                
                {/* 유사 매장 인기 상품 순위 제목 */}
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-2xl md:text-3xl font-bold text-green-600 tracking-tight">
                    유사 매장 인기 상품 순위
                  </h3>
                  <button
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-green-300 transition-colors"
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
                    내 매장 취급 상품 제외
                  </button>
                </div>
              </div>

              {/* 대분류 탭 */}
              <div className="flex flex-wrap gap-3 mb-6 md:mb-8 overflow-x-auto">
                {categories.map((category) => (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`px-5 py-2.5 rounded-lg text-base md:text-lg font-semibold transition-all duration-200 whitespace-nowrap shadow-sm ${
                      selectedCategory === category
                        ? 'bg-green-500 text-white shadow-md scale-105'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:shadow-sm'
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
                            className="bg-white border border-green-200 rounded-lg p-4 hover:shadow-md transition-shadow"
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
                                  className="flex items-start gap-2 text-xs md:text-sm text-gray-700 py-1"
                                >
                                  <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full bg-green-50 text-green-600 font-semibold text-xs mt-0.5">
                                    {index + 1}
                                  </span>
                                  <span className="flex-1">{product}</span>
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
    </Layout>
  )
}

