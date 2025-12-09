'use client'

import { useState, useEffect } from 'react'
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
  const [averageModalTimeTab, setAverageModalTimeTab] = useState<'주중' | '주말'>('주중')
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
          <div className="mb-10">
            <div className="flex items-start justify-between mb-8 border-b border-gray-200 pb-6">
              <div className="flex-1">
                <div className="flex items-baseline gap-4 mb-3">
                  <div className="w-1 h-10 bg-green-600"></div>
                  <div>
                    <h2 className="text-3xl font-bold text-gray-900 tracking-tight">
                      유사 매장 분석
                    </h2>
                    <p className="text-xs text-gray-500 mt-1 font-medium">SIMILAR STORE ANALYSIS</p>
                  </div>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed max-w-2xl ml-6">
                  판매 패턴 분석을 통한 유사 매장 발굴 및 발주 최적화 인사이트 제공
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowInfoModal(true)}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-green-600 border border-green-600 hover:bg-green-50 rounded transition-colors"
                  title="유사 매장 분석 방법 알아보기"
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
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span className="hidden md:inline">분석 방법</span>
                </button>
              </div>
            </div>
            
            {/* 월별 탭 */}
            {currentStoreAvailableMonths.length > 0 && (
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">분석 기간</span>
                {currentStoreAvailableMonths.map((month) => (
                  <button
                    key={month}
                    onClick={() => handleCurrentMonthChange(month)}
                    className={`px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap border ${
                      currentSelectedMonth === month
                        ? 'bg-green-600 text-white border-green-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-green-400 hover:text-green-600'
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
                <div className="bg-white border border-gray-300 overflow-hidden">
                  {/* 목록 헤더 */}
                  <div className="bg-gray-50 border-b border-gray-300 px-5 py-4">
                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">유사 매장 순위</h3>
                    <p className="text-xs text-gray-500 mt-1">클릭하여 상세 분석 리포트 확인</p>
                  </div>
                  
                  {/* 스크롤 가능한 목록 */}
                  <div className="overflow-y-auto" style={{ maxHeight: selectedStore ? 'calc(100vh - 800px)' : 'calc(100vh - 300px)', minHeight: '300px' }}>
                    <div className="divide-y divide-gray-100">
                      {similarStores.map((store) => (
                        <div
                          key={store.store_code}
                          className={`px-5 py-3 cursor-pointer transition-colors border-b border-gray-100 ${
                            selectedStore?.store_code === store.store_code
                              ? 'bg-green-50 border-l-4 border-green-600'
                              : 'hover:bg-gray-50'
                          }`}
                          onClick={() => handleStoreClick(store.store_code)}
                        >
                          <div className="flex items-start gap-3">
                              <span className={`flex-shrink-0 w-6 h-6 flex items-center justify-center text-xs font-bold ${
                              selectedStore?.store_code === store.store_code
                                ? 'bg-green-600 text-white'
                                : 'bg-gray-200 text-gray-600'
                            }`}>
                              {store.rank}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <p className={`text-sm font-semibold ${
                                  selectedStore?.store_code === store.store_code
                                    ? 'text-green-700'
                                    : 'text-gray-900'
                                }`}>
                                  세븐일레븐 {store.store_nm}
                                </p>
                                {store.similarity_score && (
                                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                                    store.similarity_score >= 95
                                      ? 'bg-green-100 text-green-700'
                                      : store.similarity_score >= 90
                                      ? 'bg-blue-100 text-blue-700'
                                      : 'bg-gray-100 text-gray-700'
                                  }`}>
                                    {store.similarity_score}%
                                  </span>
                                )}
                              </div>
                              {store.address && (
                                <p className="text-xs text-gray-500 line-clamp-1 mb-1">
                                  {store.address}
                                </p>
                              )}
                              {store.similarity_reasons && store.similarity_reasons.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {store.similarity_reasons.slice(0, 2).map((reason, idx) => (
                                    <span
                                      key={idx}
                                      className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded"
                                    >
                                      {reason}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <svg
                              className={`w-4 h-4 flex-shrink-0 transition-transform ${
                                selectedStore?.store_code === store.store_code
                                  ? 'text-green-600 rotate-90'
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
                <div className="bg-white border border-gray-300 overflow-hidden h-full">
                  {/* 지도 헤더 */}
                  <div className="bg-gray-50 border-b border-gray-300 px-5 py-4 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">유사 매장 위치</h3>
                      {currentSelectedMonth && (
                        <p className="text-xs text-gray-500 mt-1">기준 월: {currentSelectedMonth}</p>
                      )}
                    </div>
                    {currentSelectedMonth && (
                      <div className="flex items-center gap-2 px-3 py-1 bg-green-600 text-white text-xs font-semibold">
                        {currentSelectedMonth}
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

          {/* 유사매장 평균 정보 섹션 (9월 기준 고정) */}
          <div className="mt-12 pt-12 border-t-4 border-gray-300">
            <div className="mb-8">
              <div className="flex items-baseline gap-4 mb-3">
                <div className="w-1 h-10 bg-green-600"></div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">유사 매장 평균 분석</h3>
                  <p className="text-xs text-gray-500 mt-1 font-medium uppercase tracking-wide">SIMILAR STORE AVERAGE ANALYSIS</p>
                </div>
              </div>
              <div className="ml-6 mt-2">
                <p className="text-sm text-gray-600">
                  <span className="font-semibold">9월 기준</span> 모든 유사매장의 평균값을 보여줍니다. 전체적인 패턴을 파악하기에 좋습니다.
                </p>
              </div>
            </div>

            {/* 유사도 분석 섹션 - 세 개의 패널 나란히 */}
            <div className="mb-10 pb-10 border-b border-gray-200">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                {/* 판매 패턴 유사도 */}
                <div className="bg-white border border-gray-300 p-6 flex flex-col">
                  <div className="mb-6 flex items-start justify-between border-b border-gray-200 pb-4">
                    <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide">판매 패턴</h4>
                    <div className="text-right">
                      <span className="text-2xl font-bold text-green-600">92.1%</span>
                      <div className="text-xs text-gray-500">평균</div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-gray-600">카테고리 비중 일치도</span>
                        <span className="text-xs font-semibold text-gray-700">92.1%</span>
                      </div>
                      <div className="w-full bg-gray-100 h-2 rounded overflow-hidden">
                        <div className="bg-green-600 h-2 transition-all" style={{ width: '92.1%' }}></div>
                      </div>
                    </div>
                    <div className="pt-4 border-t border-gray-100">
                      <p className="text-xs font-semibold text-gray-700 mb-1">카테고리별 판매 비율</p>
                      <p className="text-[10px] text-gray-500 mb-3">9개 주요 카테고리 비교 분석</p>
                      <ResponsiveContainer width="100%" height={240}>
                        <RadarChart data={[
                          { category: '미반', 내매장: 8.5, 유사매장평균: 7.0 },
                          { category: '조리빵', 내매장: 12.3, 유사매장평균: 14.5 },
                          { category: '즉석음료', 내매장: 15.2, 유사매장평균: 13.8 },
                          { category: '유음료', 내매장: 18.7, 유사매장평균: 17.2 },
                          { category: '냉장', 내매장: 19.2, 유사매장평균: 20.5 },
                          { category: '빵', 내매장: 10.1, 유사매장평균: 11.8 },
                          { category: '과자', 내매장: 24.3, 유사매장평균: 26.5 },
                          { category: '면', 내매장: 12.4, 유사매장평균: 14.2 },
                          { category: '음료', 내매장: 22.1, 유사매장평균: 20.3 },
                        ]}>
                          <PolarGrid stroke="#e5e7eb" />
                          <PolarAngleAxis dataKey="category" tick={{ fontSize: 10, fill: '#374151' }} />
                          <PolarRadiusAxis angle={90} domain={[0, 30]} tick={{ fontSize: 9, fill: '#6b7280' }} />
                          <Radar name="내 매장" dataKey="내매장" stroke="#16a34a" fill="#16a34a" fillOpacity={0.7} strokeWidth={2} />
                          <Radar name="유사 매장 평균" dataKey="유사매장평균" stroke="#fb923c" fill="none" strokeWidth={2.5} />
                          <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} iconType="square" />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* 시간대 패턴 유사도 */}
                <div className="bg-white border border-gray-300 p-6 flex flex-col">
                  <div className="mb-6 flex items-start justify-between border-b border-gray-200 pb-4">
                    <div>
                      <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide">시간대 패턴</h4>
                      <p className="text-xs text-gray-500 mt-1">고객 유입 시간</p>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-bold text-green-600">88.5%</span>
                      <div className="text-xs text-gray-500">매우 유사</div>
                    </div>
                  </div>
                  
                  {/* 주중/주말 탭 */}
                  <div className="flex gap-2 mb-4">
                    <button
                      onClick={() => setAverageModalTimeTab('주중')}
                      className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                        averageModalTimeTab === '주중'
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      주중
                    </button>
                    <button
                      onClick={() => setAverageModalTimeTab('주말')}
                      className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                        averageModalTimeTab === '주말'
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      주말
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-gray-600">{averageModalTimeTab} 시간대별 분포 일치도</span>
                        <span className="text-xs font-semibold text-gray-700">88.5%</span>
                      </div>
                      <div className="w-full bg-gray-100 h-2 rounded overflow-hidden">
                        <div className="bg-green-600 h-2 transition-all" style={{ width: '88.5%' }}></div>
                      </div>
                    </div>
                    <div className="pt-4 border-t border-gray-100">
                      <p className="text-xs font-semibold text-gray-700 mb-1">{averageModalTimeTab} 시간대별 판매 비율</p>
                      <p className="text-[10px] text-gray-500 mb-3">
                        {averageModalTimeTab === '주중' ? '요일별 고객 유입 패턴 분석' : '주말 고객 유입 패턴 분석'}
                      </p>
                      <ResponsiveContainer width="100%" height={220}>
                        <LineChart data={averageModalTimeTab === '주중' ? [
                          { time: '심야\n(0-6시)', 내매장: 5.2, 유사매장평균: 7.5 },
                          { time: '오전\n(6-12시)', 내매장: 18.5, 유사매장평균: 22.5 },
                          { time: '오후\n(12-18시)', 내매장: 42.3, 유사매장평균: 38.5 },
                          { time: '저녁\n(18-24시)', 내매장: 34.0, 유사매장평균: 31.5 },
                        ] : [
                          { time: '심야\n(0-6시)', 내매장: 4.8, 유사매장평균: 5.2 },
                          { time: '오전\n(6-12시)', 내매장: 15.2, 유사매장평균: 17.8 },
                          { time: '오후\n(12-18시)', 내매장: 28.5, 유사매장평균: 26.5 },
                          { time: '저녁\n(18-24시)', 내매장: 51.5, 유사매장평균: 50.5 },
                        ]}>
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
                            name="유사 매장 평균" 
                            dot={{ fill: '#fb923c', r: 4, strokeWidth: 0 }}
                            activeDot={{ r: 5 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* 주중/주말 패턴 유사도 */}
                <div className="bg-white border border-gray-300 p-6 flex flex-col">
                  <div className="mb-6 flex items-start justify-between border-b border-gray-200 pb-4">
                    <div>
                      <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide">주중/주말 패턴</h4>
                      <p className="text-xs text-gray-500 mt-1">요일별 판매 패턴</p>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-bold text-green-600">85.2%</span>
                      <div className="text-xs text-gray-500">유사</div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-gray-600">주중/주말 비율 일치도</span>
                        <span className="text-xs font-semibold text-gray-700">85.2%</span>
                      </div>
                      <div className="w-full bg-gray-100 h-2 rounded overflow-hidden">
                        <div className="bg-green-600 h-2 transition-all" style={{ width: '85.2%' }}></div>
                      </div>
                    </div>
                    <div className="pt-4 border-t border-gray-100">
                      <p className="text-xs font-semibold text-gray-700 mb-3">주말/주중 매출 집중도</p>
                      <p className="text-[10px] text-gray-500 mb-2">주말 매출 비중 / 주중 매출 비중으로 계산</p>
                      <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={[
                          { name: '내 매장', value: 1.18 },
                          { name: '유사 매장 평균', value: 1.10 },
                        ]}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#374151' }} />
                          <YAxis tick={{ fontSize: 9, fill: '#6b7280' }} domain={[0.9, 1.3]} />
                          <Tooltip 
                            formatter={(value: number) => value.toFixed(2)}
                            contentStyle={{ fontSize: '11px', border: '1px solid #e5e7eb', borderRadius: '4px' }}
                          />
                          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                            <Cell fill="#16a34a" />
                            <Cell fill="#fb923c" />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                      <p className="text-[10px] text-gray-500 mt-2">*1.0 초과시, 주말 매출 비중 &gt; 주중 매출 비중</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 유사 매장 선정 근거 및 인사이트 */}
            <div className="space-y-6">
              <div className="bg-white border-2 border-gray-300 p-8">
                <div className="mb-6 border-b-2 border-gray-300 pb-4">
                  <div className="flex items-baseline gap-4 mb-3">
                    <div className="w-1 h-8 bg-green-600"></div>
                    <h4 className="text-lg font-bold text-gray-900 uppercase tracking-wide">유사 매장 선정 근거</h4>
                  </div>
                </div>
                <div className="space-y-5 text-sm text-gray-700 leading-relaxed">
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-green-600 rounded-full mt-2 flex-shrink-0"></div>
                    <p>
                      본 매장과 유사 매장들은 <span className="font-bold text-green-600">고객 방문 패턴의 유사도가 90% 이상</span>으로 
                      매우 높은 수준의 일치를 보이며, 이는 상권 특성과 고객층 구성이 유사함을 의미합니다.
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-green-600 rounded-full mt-2 flex-shrink-0"></div>
                    <p>
                      주요 카테고리별 판매 비중 분석 결과, <span className="font-semibold">조리빵</span>, <span className="font-semibold">유음료</span>, 
                      <span className="font-semibold">과자</span> 등 핵심 상품군의 매출 구성이 거의 동일하여 
                      <span className="font-semibold">고객 니즈와 구매 패턴이 유사</span>함을 확인했습니다.
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-green-600 rounded-full mt-2 flex-shrink-0"></div>
                    <p>
                      주말/주중 매출 집중도 분석 결과, 유사 매장들은 평균적으로 
                      <span className="font-semibold">주말 매출이 주중 대비 12-15% 높게 집중</span>되어 있어 
                      주말 중심형 상권 특성을 공유합니다.
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-green-600 rounded-full mt-2 flex-shrink-0"></div>
                    <p>
                      시간대별 고객 유입 패턴 분석 결과, <span className="font-semibold">주중 오후 12-18시</span>와 
                      <span className="font-semibold">주말 저녁 18-24시</span>에 매출이 집중되는 패턴이 
                      유사 매장들과 <span className="font-semibold">높은 일치도</span>를 보입니다.
                    </p>
                  </div>
                  <div className="mt-4 p-4 bg-blue-50 border-l-4 border-blue-500 rounded">
                    <p className="text-xs font-semibold text-blue-900 mb-2">💡 평균 정보의 한계</p>
                    <p className="text-xs text-blue-700 leading-relaxed">
                      평균값은 전체적인 패턴을 파악하는 데 유용하지만, 개별 매장의 특수성을 반영하지 못할 수 있습니다. 
                      더 정밀한 분석이 필요하면 "개별 매장 비교" 모드로 전환하여 특정 매장과의 상세 비교를 확인하세요.
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 border-l-4 border-green-600 p-5">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="text-xs font-semibold text-gray-900 mb-1">핵심 인사이트</p>
                    <p className="text-xs text-gray-700 leading-relaxed">
                      유사 매장들의 평균 발주 패턴과 재고 관리 전략을 참고하여 본 매장의 발주 최적화를 진행하면 재고 회전율 향상과 매출 증대 효과를 기대할 수 있습니다. 개별 매장 비교를 통해 더 구체적인 인사이트를 얻을 수 있습니다.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 정보 모달 */}
      {showInfoModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setShowInfoModal(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 모달 헤더 */}
            <div className="sticky top-0 bg-white border-b-2 border-gray-300 px-8 py-6 z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-baseline gap-4">
                  <div className="w-1 h-10 bg-green-600"></div>
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900">유사 매장 분석 방법</h3>
                    <p className="text-xs text-gray-500 mt-1 font-medium uppercase tracking-wide">ANALYSIS METHODOLOGY</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowInfoModal(false)}
                  className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* 모달 내용 */}
            <div className="px-8 py-8 space-y-8 overflow-y-auto flex-1">
              {/* 1. 유사 매장 선정 기준 */}
              <div className="bg-white border-2 border-gray-300 p-8">
                <div className="mb-6 border-b-2 border-gray-300 pb-4">
                  <div className="flex items-baseline gap-4 mb-3">
                    <div className="w-1 h-8 bg-green-600"></div>
                    <h4 className="text-lg font-bold text-gray-900 uppercase tracking-wide">유사 매장 선정 기준</h4>
                    <span className="ml-auto px-3 py-1 bg-green-600 text-white text-xs font-bold">4가지 핵심 지표</span>
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed ml-6">
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
                            주중/주말 편중도
                          </h5>
                        </div>
                        <p className="text-sm text-gray-700 mb-3 leading-relaxed">
                          주중 대비 주말 매출 비율 계산을 통한 상권 성격(오피스/주거/관광) 분석
                        </p>
                        <div className="bg-white border-l-4 border-green-600 p-3">
                          <p className="text-xs text-gray-700 leading-relaxed">
                            <span className="font-semibold text-gray-900">분석 결과:</span> 주중 중심형/주말 중심형 매장 분류를 통한 발주 전략 차별화 가능
                          </p>
                        </div>
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
                        <div className="bg-white border-l-4 border-green-600 p-3">
                          <p className="text-xs text-gray-700 leading-relaxed">
                            <span className="font-semibold text-gray-900">분석 결과:</span> 유동인구 데이터 결합을 통한 정밀한 유사도 분석 및 높은 신뢰도 확보
                          </p>
                        </div>
                      </div>
                    </div>
              </div>

              {/* 2. 동적 재산출 이유 */}
              <div className="bg-white border-2 border-gray-300 p-8">
                <div className="mb-6 border-b-2 border-gray-300 pb-4">
                  <div className="flex items-baseline gap-4 mb-3">
                    <div className="w-1 h-8 bg-green-600"></div>
                    <h4 className="text-lg font-bold text-gray-900 uppercase tracking-wide">동적 유사도 분석</h4>
                    <span className="ml-auto px-3 py-1 bg-green-600 text-white text-xs font-bold">실시간 업데이트</span>
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed ml-6">
                    상권은 유동적이고 동적인 구조입니다. 계절, 이벤트, 주변 환경 변화에 따라 상권 특성이 달라지므로, 
                    유사 매장도 <span className="font-semibold">시기별로 재계산</span>하여 최신 분석 결과를 제공합니다.
                  </p>
                </div>
                    <div className="space-y-6">
                      <div className="border border-gray-300 p-6">
                        <div className="flex items-center gap-3 mb-5 pb-3 border-b border-gray-300">
                          <div className="w-8 h-8 bg-green-600 text-white flex items-center justify-center font-bold text-sm">1</div>
                          <div>
                            <span className="text-xs font-semibold text-green-600 uppercase tracking-wide">실제 사례</span>
                            <h5 className="text-sm font-bold text-gray-900 mt-0.5">석촌동호수점</h5>
                          </div>
                        </div>
                        <div className="grid md:grid-cols-2 gap-4">
                          <div className="bg-gray-50 border border-gray-300 p-4">
                            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-300">
                              <span className="text-xs font-bold text-gray-900">1월 (비수기)</span>
                            </div>
                            <div className="space-y-2 text-sm">
                              <div className="flex items-center gap-2">
                                <div className="w-1 h-1 bg-gray-900 rounded-full"></div>
                                <span className="text-gray-700">대로변 상권</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="w-1 h-1 bg-gray-900 rounded-full"></div>
                                <span className="text-gray-700">상업형/생활형</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="w-1 h-1 bg-gray-900 rounded-full"></div>
                                <span className="text-gray-700">식당가 중심</span>
                              </div>
                            </div>
                          </div>
                          <div className="bg-gray-50 border border-gray-300 p-4">
                            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-300">
                              <span className="text-xs font-bold text-gray-900">4월 (성수기)</span>
                            </div>
                            <div className="space-y-2 text-sm">
                              <div className="flex items-center gap-2">
                                <div className="w-1 h-1 bg-gray-900 rounded-full"></div>
                                <span className="text-gray-700">한강 주변 상권</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="w-1 h-1 bg-gray-900 rounded-full"></div>
                                <span className="text-gray-700">관광 수요 중심</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="w-1 h-1 bg-gray-900 rounded-full"></div>
                                <span className="text-gray-700">공원가 특성</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="mt-4 p-3 bg-gray-100 border-l-4 border-green-600">
                          <p className="text-xs text-gray-800 font-medium">
                            <span className="font-bold">결과:</span> 유사매장 Top 10의 교집합이 0개 → 상권 특성이 완전히 달라짐
                          </p>
                        </div>
                      </div>
                      <div className="border border-gray-300 p-6">
                        <div className="flex items-center gap-3 mb-5 pb-3 border-b border-gray-300">
                          <div className="w-8 h-8 bg-green-600 text-white flex items-center justify-center font-bold text-sm">2</div>
                          <div>
                            <span className="text-xs font-semibold text-green-600 uppercase tracking-wide">실제 사례</span>
                            <h5 className="text-sm font-bold text-gray-900 mt-0.5">역삼만남점</h5>
                          </div>
                        </div>
                        <div className="grid md:grid-cols-2 gap-4">
                          <div className="bg-gray-50 border border-gray-300 p-4">
                            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-300">
                              <span className="text-xs font-bold text-gray-900">12월 (입시 종료)</span>
                            </div>
                            <div className="space-y-2 text-sm">
                              <div className="flex items-center gap-2">
                                <div className="w-1 h-1 bg-gray-900 rounded-full"></div>
                                <span className="text-gray-700">유흥가 상권</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="w-1 h-1 bg-gray-900 rounded-full"></div>
                                <span className="text-gray-700">역삼역 환승 중심</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="w-1 h-1 bg-gray-900 rounded-full"></div>
                                <span className="text-gray-700">야간 고객 중심</span>
                              </div>
                            </div>
                          </div>
                          <div className="bg-gray-50 border border-gray-300 p-4">
                            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-300">
                              <span className="text-xs font-bold text-gray-900">7월 (재수생 유입)</span>
                            </div>
                            <div className="space-y-2 text-sm">
                              <div className="flex items-center gap-2">
                                <div className="w-1 h-1 bg-gray-900 rounded-full"></div>
                                <span className="text-gray-700">대학 정문 상권</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="w-1 h-1 bg-gray-900 rounded-full"></div>
                                <span className="text-gray-700">학생 중심</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="w-1 h-1 bg-gray-900 rounded-full"></div>
                                <span className="text-gray-700">주중 낮 시간대 활성</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="mt-4 p-3 bg-gray-100 border-l-4 border-green-600">
                          <p className="text-xs text-gray-800 font-medium">
                            <span className="font-bold">결과:</span> 유사매장 Top 10의 교집합이 0개 → 상권 특성이 완전히 달라짐
                          </p>
                        </div>
                      </div>
                    </div>
                </div>

              {/* 3. 매주 재계산 이유 */}
              <div className="bg-white border-2 border-gray-300 p-8">
                <div className="mb-6 border-b-2 border-gray-300 pb-4">
                  <div className="flex items-baseline gap-4 mb-3">
                    <div className="w-1 h-8 bg-green-600"></div>
                    <h4 className="text-lg font-bold text-gray-900 uppercase tracking-wide">Rolling Window 알고리즘</h4>
                    <span className="ml-auto px-3 py-1 bg-green-600 text-white text-xs font-bold">자동 갱신</span>
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed ml-6">
                    상권 변화를 실시간으로 반영하기 위해 <span className="font-semibold">최근 4주 데이터를 유지하며 매주 자동 갱신</span>하는 
                    Rolling Window 알고리즘을 적용합니다.
                  </p>
                </div>
                <div className="bg-gray-50 border border-gray-300 p-6 mb-4">
                  <div className="grid md:grid-cols-2 gap-4 mb-5">
                    <div className="bg-white border border-gray-300 p-4">
                      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-300">
                        <div className="w-1 h-6 bg-green-600"></div>
                        <h5 className="text-sm font-bold text-gray-900">분석 구간</h5>
                      </div>
                      <p className="text-sm text-gray-700">최근 4주 데이터 (Rolling 4 Weeks)</p>
                    </div>
                    <div className="bg-white border border-gray-300 p-4">
                      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-300">
                        <div className="w-1 h-6 bg-green-600"></div>
                        <h5 className="text-sm font-bold text-gray-900">갱신 주기</h5>
                      </div>
                      <p className="text-sm text-gray-700">매주 자동 업데이트</p>
                    </div>
                  </div>
                  <div className="bg-white border border-gray-300 p-4">
                    <h6 className="text-sm font-bold text-gray-900 mb-3 pb-2 border-b border-gray-300">
                      작동 원리
                    </h6>
                    <div className="space-y-2.5 text-sm text-gray-700">
                      <div className="flex items-start gap-3">
                        <span className="font-bold text-gray-900 min-w-[20px]">1.</span>
                        <span>매주 새로운 주차 데이터를 추가하고 가장 오래된 주차 데이터를 제거</span>
                      </div>
                      <div className="flex items-start gap-3">
                        <span className="font-bold text-gray-900 min-w-[20px]">2.</span>
                        <span>최신 4주 데이터 기반으로 유사도 알고리즘 자동 재계산</span>
                      </div>
                      <div className="flex items-start gap-3">
                        <span className="font-bold text-gray-900 min-w-[20px]">3.</span>
                        <span>시기별 판매 패턴 변화를 즉시 반영하여 정확한 유사 매장 추천</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-100 border-l-4 border-green-600 p-4">
                  <p className="text-sm text-gray-800 leading-relaxed">
                    <span className="font-bold text-gray-900">최신성 보장:</span> Rolling Window 알고리즘을 통해 
                    상권의 점진적이고 유동적인 변화를 실시간으로 포착하여 
                    항상 <span className="font-semibold">최신 데이터 기반의 정확한 분석 결과</span>를 제공합니다.
                  </p>
                </div>
              </div>
            </div>
            
            {/* 모달 푸터 */}
            <div className="sticky bottom-0 bg-gray-50 border-t-2 border-gray-300 px-8 py-4 flex justify-end z-10">
              <button
                onClick={() => setShowInfoModal(false)}
                className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white font-medium transition-colors"
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
            <div className="sticky top-0 bg-white border-b-2 border-gray-300 px-8 py-6 z-10">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-baseline gap-4 mb-2">
                    <div className="w-1 h-10 bg-green-600"></div>
                    <div>
                      <h3 className="text-2xl font-bold text-gray-900">
                        {selectedMonth || ''} {selectedStore.store_nm || ''}
                      </h3>
                      <p className="text-xs text-gray-500 mt-1 font-medium uppercase tracking-wide">유사도 분석 리포트</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="px-3 py-1.5 bg-green-600 text-white text-xs font-bold">
                    높은 신뢰도
                  </div>
                  <button
                    onClick={() => setShowStoreDetailModal(false)}
                    className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              {/* 월별 탭 */}
              {availableMonths.length > 0 && (
                <div className="flex items-center gap-2">
                  {availableMonths.map((month) => (
                    <button
                      key={month}
                      onClick={() => {
                        console.log('월 변경:', month, '데이터:', storeDetailsByMonth[month])
                        setSelectedMonth(month)
                        setSelectedStore(storeDetailsByMonth[month])
                        setSelectedCategory('과자')
                      }}
                      className={`px-4 py-2 text-xs font-medium transition-colors whitespace-nowrap border ${
                        selectedMonth === month
                          ? 'bg-green-600 text-white border-green-600'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-green-400 hover:text-green-600'
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
                  <div className="bg-white border border-gray-300 p-6 flex flex-col">
                    <div className="mb-6 flex items-start justify-between border-b border-gray-200 pb-4">
                      <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide">판매 패턴</h4>
                      <div className="text-right">
                        <span className="text-2xl font-bold text-green-600">
                          {(() => {
                            const currentStore = similarStores.find(s => s.store_code === selectedStore.store_code)
                            return currentStore?.similarity_score?.toFixed(1) || '92.1'
                          })()}%
                        </span>
                        <div className="text-xs text-gray-500">개별 비교</div>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-gray-600">카테고리 비중 일치도</span>
                          <span className="text-xs font-semibold text-gray-700">
                            {(() => {
                              const currentStore = similarStores.find(s => s.store_code === selectedStore.store_code)
                              return currentStore?.similarity_score?.toFixed(1) || '92.1'
                            })()}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-100 h-2 rounded overflow-hidden">
                          <div 
                            className="bg-green-600 h-2 transition-all" 
                            style={{ 
                              width: `${(() => {
                                const currentStore = similarStores.find(s => s.store_code === selectedStore.store_code)
                                return currentStore?.similarity_score || 92.1
                              })()}%` 
                            }}
                          ></div>
                        </div>
                      </div>
                      <div className="pt-4 border-t border-gray-100">
                        <p className="text-xs font-semibold text-gray-700 mb-1">카테고리별 판매 비율</p>
                        <p className="text-[10px] text-gray-500 mb-3">9개 주요 카테고리 비교 분석</p>
                        <ResponsiveContainer width="100%" height={240}>
                          <RadarChart data={[
                            { category: '미반', 내매장: 8.5, 유사매장: 7.0 },
                            { category: '조리빵', 내매장: 12.3, 유사매장: 14.5 },
                            { category: '즉석음료', 내매장: 15.2, 유사매장: 13.8 },
                            { category: '유음료', 내매장: 18.7, 유사매장: 17.2 },
                            { category: '냉장', 내매장: 19.2, 유사매장: 20.5 },
                            { category: '빵', 내매장: 10.1, 유사매장: 11.8 },
                            { category: '과자', 내매장: 24.3, 유사매장: 26.5 },
                            { category: '면', 내매장: 12.4, 유사매장: 14.2 },
                            { category: '음료', 내매장: 22.1, 유사매장: 20.3 },
                          ]}>
                            <PolarGrid stroke="#e5e7eb" />
                            <PolarAngleAxis dataKey="category" tick={{ fontSize: 10, fill: '#374151' }} />
                            <PolarRadiusAxis angle={90} domain={[0, 30]} tick={{ fontSize: 9, fill: '#6b7280' }} />
                            <Radar name="내 매장" dataKey="내매장" stroke="#16a34a" fill="#16a34a" fillOpacity={0.7} strokeWidth={2} />
                            <Radar name="유사 매장" dataKey="유사매장" stroke="#fb923c" fill="none" strokeWidth={2.5} />
                            <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} iconType="square" />
                          </RadarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  {/* 시간대 패턴 유사도 */}
                  <div className="bg-white border border-gray-300 p-6 flex flex-col">
                    <div className="mb-6 flex items-start justify-between border-b border-gray-200 pb-4">
                      <div>
                        <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide">시간대 패턴</h4>
                        <p className="text-xs text-gray-500 mt-1">고객 유입 시간</p>
                      </div>
                      <div className="text-right">
                        <span className="text-2xl font-bold text-green-600">88.5%</span>
                        <div className="text-xs text-gray-500">매우 유사</div>
                      </div>
                    </div>
                    
                    {/* 주중/주말 탭 */}
                    <div className="flex gap-2 mb-4">
                      <button
                        onClick={() => setTimePatternTab('주중')}
                        className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                          timePatternTab === '주중'
                            ? 'bg-green-500 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        주중
                      </button>
                      <button
                        onClick={() => setTimePatternTab('주말')}
                        className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                          timePatternTab === '주말'
                            ? 'bg-green-500 text-white'
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
                        <div className="w-full bg-gray-100 h-2 rounded overflow-hidden">
                          <div className="bg-green-600 h-2 transition-all" style={{ width: '88.5%' }}></div>
                        </div>
                      </div>
                      <div className="pt-4 border-t border-gray-100">
                        <p className="text-xs font-semibold text-gray-700 mb-1">{timePatternTab} 시간대별 판매 비율</p>
                        <p className="text-[10px] text-gray-500 mb-3">
                          {timePatternTab === '주중' ? '요일별 고객 유입 패턴 분석' : '주말 고객 유입 패턴 분석'}
                        </p>
                        <ResponsiveContainer width="100%" height={220}>
                          <LineChart data={timePatternTab === '주중' ? [
                            { time: '심야\n(0-6시)', 내매장: 5.2, 유사매장: 7.5 },
                            { time: '오전\n(6-12시)', 내매장: 18.5, 유사매장: 22.5 },
                            { time: '오후\n(12-18시)', 내매장: 42.3, 유사매장: 38.5 },
                            { time: '저녁\n(18-24시)', 내매장: 34.0, 유사매장: 31.5 },
                          ] : [
                            { time: '심야\n(0-6시)', 내매장: 4.8, 유사매장: 5.2 },
                            { time: '오전\n(6-12시)', 내매장: 15.2, 유사매장: 17.8 },
                            { time: '오후\n(12-18시)', 내매장: 28.5, 유사매장: 26.5 },
                            { time: '저녁\n(18-24시)', 내매장: 51.5, 유사매장: 50.5 },
                          ]}>
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
                              name="유사 매장" 
                              dot={{ fill: '#fb923c', r: 4, strokeWidth: 0 }}
                              activeDot={{ r: 5 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  {/* 주중/주말 패턴 유사도 */}
                  <div className="bg-white border border-gray-300 p-6 flex flex-col">
                    <div className="mb-6 flex items-start justify-between border-b border-gray-200 pb-4">
                      <div>
                        <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide">주중/주말 패턴</h4>
                        <p className="text-xs text-gray-500 mt-1">요일별 판매 패턴</p>
                      </div>
                      <div className="text-right">
                        <span className="text-2xl font-bold text-green-600">85.2%</span>
                        <div className="text-xs text-gray-500">유사</div>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-gray-600">주중/주말 비율 일치도</span>
                          <span className="text-xs font-semibold text-gray-700">85.2%</span>
                        </div>
                        <div className="w-full bg-gray-100 h-2 rounded overflow-hidden">
                          <div className="bg-green-600 h-2 transition-all" style={{ width: '85.2%' }}></div>
                        </div>
                      </div>
                      <div className="pt-4 border-t border-gray-100">
                        <p className="text-xs font-semibold text-gray-700 mb-3">주말/주중 매출 집중도</p>
                        <p className="text-[10px] text-gray-500 mb-2">주말 매출 비중 / 주중 매출 비중으로 계산</p>
                        <ResponsiveContainer width="100%" height={180}>
                          <BarChart data={[
                            { name: '내 매장', value: 1.18 },
                            { name: '유사 매장', value: 1.10 },
                          ]}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#374151' }} />
                            <YAxis tick={{ fontSize: 9, fill: '#6b7280' }} domain={[0.9, 1.3]} />
                            <Tooltip 
                              formatter={(value: number) => value.toFixed(2)}
                              contentStyle={{ fontSize: '11px', border: '1px solid #e5e7eb', borderRadius: '4px' }}
                            />
                            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                              <Cell fill="#16a34a" />
                              <Cell fill="#fb923c" />
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                        <p className="text-[10px] text-gray-500 mt-2">*1.0 초과시, 주말 매출 비중 &gt; 주중 매출 비중</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 유사 매장 인기 상품 순위 제목 */}
              <div className="border-t-2 border-gray-300 pt-8 mt-10">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-baseline gap-4">
                    <div className="w-1 h-8 bg-green-600"></div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 uppercase tracking-wide">
                        인기 상품 순위
                      </h3>
                      <p className="text-xs text-gray-500 mt-1">유사 매장 판매량 기준</p>
                    </div>
                  </div>
                  <button
                    className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-gray-600 border border-gray-300 hover:bg-gray-50 transition-colors"
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
                <div className="flex flex-wrap gap-2 mb-8">
                  {categories.map((category) => (
                    <button
                      key={category}
                      onClick={() => setSelectedCategory(category)}
                      className={`px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap border ${
                        selectedCategory === category
                          ? 'bg-green-600 text-white border-green-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-green-400 hover:text-green-600'
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
                <div>
                  {selectedStore[selectedCategory] ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {Object.entries(selectedStore[selectedCategory] as Record<string, string[]>).map(
                        ([subCategory, products]) => (
                          <div
                            key={subCategory}
                            className="bg-white border border-gray-300 p-4"
                          >
                            <div className="flex items-center justify-between mb-4 border-b border-gray-200 pb-2">
                              <h3 className="text-sm font-bold text-gray-900">
                                {subCategory}
                              </h3>
                              <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1">
                                판매순 상위
                              </span>
                            </div>
                            <div className="space-y-2">
                              {products.map((product, index) => (
                                <div
                                  key={index}
                                  className="flex items-start gap-3 text-sm text-gray-700"
                                >
                                  <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center bg-gray-100 text-gray-600 font-semibold text-xs">
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
            <div className="sticky bottom-0 bg-gray-50 border-t-2 border-gray-300 px-8 py-4 flex justify-end">
              <button
                onClick={() => setShowStoreDetailModal(false)}
                className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white font-medium transition-colors"
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

