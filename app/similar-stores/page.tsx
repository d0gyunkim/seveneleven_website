'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Layout from '@/components/Layout'
import { supabase } from '@/lib/supabase'

interface StoreMaster {
  store_code: string
  store_nm: string
  last_month_sale: number | null
  two_month_ago_sale: number | null
  most_sale_pro: string | null
  worst_sale_pro: string | null
  similar_pro_store_code: string[] | null
}

interface SimilarStore extends StoreMaster {
  sales_comparison_last: number // 저번달 매출 비교 (%)
  sales_comparison_two: number // 저저번달 매출 비교 (%)
}

interface CurrentStore extends StoreMaster {}

export default function SimilarStoresPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const urlStoreCode = searchParams.get('storeCode') || ''
  
  const [currentStore, setCurrentStore] = useState<CurrentStore | null>(null)
  const [similarStores, setSimilarStores] = useState<SimilarStore[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedStore, setSelectedStore] = useState<SimilarStore | null>(null)

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

    fetchSimilarStoresData(storeCode)
  }, [urlStoreCode, router])

  const fetchSimilarStoresData = async (code: string) => {
    setLoading(true)
    setError(null)

    try {
      // 매장마스터 테이블에서 현재 매장 정보 조회
      const { data: currentStoreData, error: currentStoreError } = await supabase
        .from('매장마스터')
        .select('*')
        .eq('store_code', code)
        .single()

      if (currentStoreError || !currentStoreData) {
        setError('매장 코드에 해당하는 데이터를 찾을 수 없습니다.')
        setLoading(false)
        return
      }

      // 현재 매장 정보 설정
      const current: CurrentStore = {
        store_code: currentStoreData.store_code,
        store_nm: currentStoreData.store_nm,
        last_month_sale: currentStoreData.last_month_sale,
        two_month_ago_sale: currentStoreData.two_month_ago_sale,
        most_sale_pro: currentStoreData.most_sale_pro,
        worst_sale_pro: currentStoreData.worst_sale_pro,
        similar_pro_store_code: currentStoreData.similar_pro_store_code,
      }
      setCurrentStore(current)

      // 유사 매장 코드 배열이 없거나 비어있으면 종료
      if (!currentStoreData.similar_pro_store_code || currentStoreData.similar_pro_store_code.length === 0) {
        setSimilarStores([])
        setLoading(false)
        return
      }

      // 유사 매장 코드 배열로 각 매장 정보 조회
      const similarStoreCodes = currentStoreData.similar_pro_store_code
      const similarStoresData: SimilarStore[] = []

      for (const similarCode of similarStoreCodes) {
        const { data: similarData, error: similarError } = await supabase
          .from('매장마스터')
          .select('*')
          .eq('store_code', similarCode)
          .single()

        if (!similarError && similarData) {
          // 매출 비교 계산 (%): 유사 매장 매출 / 현재 매장 매출 * 100
          let salesComparisonLast = 0
          if (current.last_month_sale && current.last_month_sale > 0 && similarData.last_month_sale) {
            salesComparisonLast = Math.round((similarData.last_month_sale / current.last_month_sale) * 100)
          }
          
          let salesComparisonTwo = 0
          if (current.two_month_ago_sale && current.two_month_ago_sale > 0 && similarData.two_month_ago_sale) {
            salesComparisonTwo = Math.round((similarData.two_month_ago_sale / current.two_month_ago_sale) * 100)
          }

          similarStoresData.push({
            store_code: similarData.store_code,
            store_nm: similarData.store_nm,
            last_month_sale: similarData.last_month_sale,
            two_month_ago_sale: similarData.two_month_ago_sale,
            most_sale_pro: similarData.most_sale_pro,
            worst_sale_pro: similarData.worst_sale_pro,
            similar_pro_store_code: similarData.similar_pro_store_code,
            sales_comparison_last: salesComparisonLast,
            sales_comparison_two: salesComparisonTwo,
          })
        } else if (similarError) {
          console.error(`유사 매장 ${similarCode} 조회 실패:`, similarError.message)
        }
      }

      setSimilarStores(similarStoresData)

    } catch (err: any) {
      console.error('데이터 조회 중 오류:', err)
      setError(`데이터를 불러오는 중 오류가 발생했습니다: ${err.message || '알 수 없는 오류'}`)
    } finally {
      setLoading(false)
    }
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
          <div className="mb-4 md:mb-6">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">유사매장 정보</h2>
            {currentStore && (
              <p className="text-xs md:text-sm text-gray-600">
                매장: <span className="text-green-500 font-semibold">{currentStore.store_nm}</span> | 
                매장 코드: <span className="text-green-500 font-semibold">{currentStore.store_code}</span>
              </p>
            )}
          </div>

          {/* 현재 매장 정보 카드 */}
          {currentStore && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-6 md:mb-8">
              {/* 저번달 매출 */}
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 md:p-6 border border-blue-200">
                <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-2">저번달 매출</h3>
                <div className="flex items-end gap-2">
                  <span className="text-4xl md:text-5xl font-bold text-blue-600">
                    {currentStore.last_month_sale ? currentStore.last_month_sale.toLocaleString() : '-'}
                  </span>
                  <span className="text-xl md:text-2xl text-gray-600 mb-1">원</span>
                </div>
              </div>

              {/* 저저번달 매출 */}
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 md:p-6 border border-purple-200">
                <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-2">저저번달 매출</h3>
                <div className="flex items-end gap-2">
                  <span className="text-4xl md:text-5xl font-bold text-purple-600">
                    {currentStore.two_month_ago_sale ? currentStore.two_month_ago_sale.toLocaleString() : '-'}
                  </span>
                  <span className="text-xl md:text-2xl text-gray-600 mb-1">원</span>
                </div>
              </div>
            </div>
          )}

          {/* 현재 매장 상품 정보 */}
          {currentStore && (currentStore.most_sale_pro || currentStore.worst_sale_pro) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-6 md:mb-8">
              {/* 가장 잘 팔린 상품 */}
              {currentStore.most_sale_pro && (
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 md:p-6 border border-green-200">
                  <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-2">가장 잘 팔린 상품</h3>
                  <p className="text-xl md:text-2xl font-semibold text-green-600">
                    {currentStore.most_sale_pro}
                  </p>
                </div>
              )}

              {/* 가장 잘 팔리지 않은 상품 */}
              {currentStore.worst_sale_pro && (
                <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-4 md:p-6 border border-orange-200">
                  <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-2">가장 잘 팔리지 않은 상품</h3>
                  <p className="text-xl md:text-2xl font-semibold text-orange-600">
                    {currentStore.worst_sale_pro}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 유사 매장 평균 매출 비교 */}
          {similarStores.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 mb-6 md:mb-8">
              {/* 저번달 평균 매출 비교 */}
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 md:p-6 border border-blue-200">
                <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-2">유사 매장 저번달 평균 매출</h3>
                <div className="flex items-end gap-2">
                  <span className="text-4xl md:text-5xl font-bold text-blue-600">
                    {similarStores.length > 0 
                      ? Math.round(similarStores.reduce((sum, store) => sum + store.sales_comparison_last, 0) / similarStores.length)
                      : 0}
                  </span>
                  <span className="text-xl md:text-2xl text-gray-600 mb-1">%</span>
                </div>
                <p className="text-xs md:text-sm text-gray-600 mt-2">
                  현재 매장 대비 평균 매출 비율
                </p>
              </div>

              {/* 저저번달 평균 매출 비교 */}
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 md:p-6 border border-purple-200">
                <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-2">유사 매장 저저번달 평균 매출</h3>
                <div className="flex items-end gap-2">
                  <span className="text-4xl md:text-5xl font-bold text-purple-600">
                    {similarStores.length > 0
                      ? Math.round(similarStores.reduce((sum, store) => sum + store.sales_comparison_two, 0) / similarStores.length)
                      : 0}
                  </span>
                  <span className="text-xl md:text-2xl text-gray-600 mb-1">%</span>
                </div>
                <p className="text-xs md:text-sm text-gray-600 mt-2">
                  현재 매장 대비 평균 매출 비율
                </p>
              </div>
            </div>
          )}

          {/* 유사 매장 목록 */}
          {similarStores.length > 0 ? (
            <div className="mb-6 md:mb-8">
              <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-4">유사 매장 목록 ({similarStores.length}개)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                {similarStores.map((store) => (
                  <div
                    key={store.store_code}
                    onClick={() => setSelectedStore(store)}
                    className="bg-white rounded-lg border border-gray-200 p-4 md:p-5 hover:border-green-400 hover:shadow-md transition-all cursor-pointer"
                  >
                    <div className="mb-3">
                      <h4 className="text-lg md:text-xl font-bold text-gray-900 mb-2">{store.store_nm}</h4>
                      <p className="text-xs md:text-sm text-gray-600">매장 코드: {store.store_code}</p>
                    </div>
                    
                    <div className="space-y-3 pt-3 border-t border-gray-100">
                      {/* 저번달 매출 */}
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-gray-500">저번달 매출</p>
                        <div className="text-right">
                          <p className="text-sm md:text-base font-semibold text-blue-600">
                            {store.last_month_sale ? store.last_month_sale.toLocaleString() : '-'}원
                          </p>
                          <p className={`text-xs font-medium ${
                            store.sales_comparison_last >= 100 ? 'text-green-600' : 'text-gray-600'
                          }`}>
                            (현재 대비 {store.sales_comparison_last}%)
                          </p>
                        </div>
                      </div>

                      {/* 저저번달 매출 */}
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-gray-500">저저번달 매출</p>
                        <div className="text-right">
                          <p className="text-sm md:text-base font-semibold text-purple-600">
                            {store.two_month_ago_sale ? store.two_month_ago_sale.toLocaleString() : '-'}원
                          </p>
                          <p className={`text-xs font-medium ${
                            store.sales_comparison_two >= 100 ? 'text-green-600' : 'text-gray-600'
                          }`}>
                            (현재 대비 {store.sales_comparison_two}%)
                          </p>
                        </div>
                      </div>

                      {/* 가장 잘 팔린 상품 */}
                      {store.most_sale_pro && (
                        <div className="pt-2 border-t border-gray-100">
                          <p className="text-xs text-gray-500 mb-1">가장 잘 팔린 상품</p>
                          <p className="text-sm font-semibold text-green-600 truncate">
                            {store.most_sale_pro}
                          </p>
                        </div>
                      )}

                      {/* 가장 잘 팔리지 않은 상품 */}
                      {store.worst_sale_pro && (
                        <div>
                          <p className="text-xs text-gray-500 mb-1">가장 잘 팔리지 않은 상품</p>
                          <p className="text-sm font-semibold text-orange-600 truncate">
                            {store.worst_sale_pro}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="mb-6 md:mb-8">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 md:p-8 text-center">
                <p className="text-gray-600">유사 매장이 없습니다.</p>
              </div>
            </div>
          )}

          {/* 유사 매장 상품 집계 */}
          {similarStores.length > 0 && (
            <div className="mb-6 md:mb-8">
              <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-4">유사 매장 상품 정보</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                {/* 유사 매장에서 가장 잘 팔린 상품들 */}
                <div className="bg-white rounded-lg border border-gray-200 p-4 md:p-6">
                  <h4 className="text-lg md:text-xl font-bold text-gray-900 mb-4">가장 잘 팔린 상품</h4>
                  <div className="space-y-2">
                    {similarStores
                      .filter(store => store.most_sale_pro)
                      .map((store, index) => (
                        <div key={store.store_code} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm md:text-base font-semibold text-gray-900 truncate">
                              {store.most_sale_pro}
                            </p>
                            <p className="text-xs text-gray-500">{store.store_nm}</p>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>

                {/* 유사 매장에서 가장 잘 팔리지 않은 상품들 */}
                <div className="bg-white rounded-lg border border-gray-200 p-4 md:p-6">
                  <h4 className="text-lg md:text-xl font-bold text-gray-900 mb-4">가장 잘 팔리지 않은 상품</h4>
                  <div className="space-y-2">
                    {similarStores
                      .filter(store => store.worst_sale_pro)
                      .map((store, index) => (
                        <div key={store.store_code} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm md:text-base font-semibold text-gray-900 truncate">
                              {store.worst_sale_pro}
                            </p>
                            <p className="text-xs text-gray-500">{store.store_nm}</p>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 유사 매장 상세 정보 모달 */}
          {selectedStore && (
            <div
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 md:p-4"
              onClick={() => setSelectedStore(null)}
            >
              <div
                className="bg-white rounded-lg border border-gray-200 max-w-2xl w-full max-h-[90vh] md:max-h-[80vh] overflow-y-auto shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-4 md:p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1 pr-2">
                      <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-2">{selectedStore.store_nm}</h3>
                      <p className="text-sm text-gray-600">매장 코드: {selectedStore.store_code}</p>
                    </div>
                    <button
                      onClick={() => setSelectedStore(null)}
                      className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
                      aria-label="닫기"
                    >
                      <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  <div className="space-y-4">
                    {/* 매출 정보 */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="text-sm font-semibold text-gray-700 mb-3">매출 정보</h4>
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <p className="text-xs text-gray-500 mb-1">저번달 매출</p>
                          <p className="text-2xl font-bold text-blue-600">
                            {selectedStore.last_month_sale ? selectedStore.last_month_sale.toLocaleString() : '-'}원
                          </p>
                          <p className={`text-xs font-medium mt-1 ${
                            selectedStore.sales_comparison_last >= 100 ? 'text-green-600' : 'text-gray-600'
                          }`}>
                            현재 매장 대비 {selectedStore.sales_comparison_last}%
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">저저번달 매출</p>
                          <p className="text-2xl font-bold text-purple-600">
                            {selectedStore.two_month_ago_sale ? selectedStore.two_month_ago_sale.toLocaleString() : '-'}원
                          </p>
                          <p className={`text-xs font-medium mt-1 ${
                            selectedStore.sales_comparison_two >= 100 ? 'text-green-600' : 'text-gray-600'
                          }`}>
                            현재 매장 대비 {selectedStore.sales_comparison_two}%
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* 상품 정보 */}
                    {(selectedStore.most_sale_pro || selectedStore.worst_sale_pro) && (
                      <div className="bg-gray-50 rounded-lg p-4">
                        <h4 className="text-sm font-semibold text-gray-700 mb-3">상품 정보</h4>
                        <div className="space-y-3">
                          {selectedStore.most_sale_pro && (
                            <div>
                              <p className="text-xs text-gray-500 mb-1">가장 잘 팔린 상품</p>
                              <p className="text-base font-semibold text-green-600">{selectedStore.most_sale_pro}</p>
                            </div>
                          )}
                          {selectedStore.worst_sale_pro && (
                            <div>
                              <p className="text-xs text-gray-500 mb-1">가장 잘 팔리지 않은 상품</p>
                              <p className="text-base font-semibold text-orange-600">{selectedStore.worst_sale_pro}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-r-lg">
                      <p className="text-sm text-gray-800">
                        이 매장은 점주님의 매장과 유사한 특성을 가지고 있습니다. 
                        매출 정보와 상품 정보를 참고하시면 매장 운영에 도움이 될 수 있습니다.
                      </p>
                    </div>
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

