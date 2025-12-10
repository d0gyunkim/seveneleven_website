'use client'

import Layout from '@/components/Layout'

export default function OverviewPage() {
  return (
    <Layout>
      <div className="bg-gradient-to-br from-gray-50 via-white to-gray-50 min-h-screen">
        <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8 py-8 md:py-12">
          {/* 페이지 제목 */}
          <div className="mb-8 md:mb-12">
            <div className="flex items-baseline gap-3 mb-4">
              <div className="w-1 h-10 bg-emerald-500 rounded-full"></div>
              <div>
                <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">
                  서비스 개요
                </h1>
                <p className="text-sm md:text-base text-slate-600 mt-2 font-medium">
                  데이터 기반 맞춤형 상품 추천 및 발주 최적화 인사이트 제공
                </p>
              </div>
            </div>
          </div>

          {/* 주요 기능 섹션 */}
          <div className="grid md:grid-cols-2 gap-6 md:gap-8 mb-12">
            {/* 발주 추천 */}
            <div className="bg-white rounded-xl p-6 md:p-8 shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                </div>
                <h2 className="text-xl md:text-2xl font-bold text-slate-900">발주 추천</h2>
              </div>
              <p className="text-slate-700 leading-relaxed mb-4">
                유사 매장들의 판매 데이터를 분석하여 우리 매장에 추천할 상품을 선별합니다. 
                최근 판매 실적, 판매 빈도, 매출액을 종합적으로 고려하여 판매 성과가 우수한 상품을 추천합니다.
              </p>
              <ul className="space-y-2 text-sm text-slate-600">
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500 mt-1">•</span>
                  <span>유사 매장 기반 상품 추천</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500 mt-1">•</span>
                  <span>R, F, M 지표 기반 분석</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500 mt-1">•</span>
                  <span>카테고리별 상품 필터링</span>
                </li>
              </ul>
            </div>

            {/* 부진재고 분석 */}
            <div className="bg-white rounded-xl p-6 md:p-8 shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h2 className="text-xl md:text-2xl font-bold text-slate-900">부진재고 분석</h2>
              </div>
              <p className="text-slate-700 leading-relaxed mb-4">
                매장의 상품군별 발주 제외 권장 대상 상품을 분석합니다. 
                판매 실적이 낮은 상품을 식별하여 매장 운영 효율화에 도움을 드립니다.
              </p>
              <ul className="space-y-2 text-sm text-slate-600">
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 mt-1">•</span>
                  <span>판매 실적 기반 분석</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 mt-1">•</span>
                  <span>발주 제외 권장 상품 식별</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 mt-1">•</span>
                  <span>매장 운영 효율화 지원</span>
                </li>
              </ul>
            </div>

            {/* 유사매장 분석 */}
            <div className="bg-white rounded-xl p-6 md:p-8 shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <h2 className="text-xl md:text-2xl font-bold text-slate-900">유사매장 분석</h2>
              </div>
              <p className="text-slate-700 leading-relaxed mb-4">
                우리 매장과 유사한 특성을 가진 매장들을 분석하여 참고할 수 있는 인사이트를 제공합니다. 
                유사 매장의 판매 패턴과 트렌드를 파악할 수 있습니다.
              </p>
              <ul className="space-y-2 text-sm text-slate-600">
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-1">•</span>
                  <span>유사 매장 식별 및 분석</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-1">•</span>
                  <span>판매 패턴 비교 분석</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-1">•</span>
                  <span>트렌드 파악 지원</span>
                </li>
              </ul>
            </div>

            {/* 데이터 기반 의사결정 */}
            <div className="bg-white rounded-xl p-6 md:p-8 shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h2 className="text-xl md:text-2xl font-bold text-slate-900">데이터 기반 의사결정</h2>
              </div>
              <p className="text-slate-700 leading-relaxed mb-4">
                실제 판매 데이터를 기반으로 한 객관적인 분석 결과를 제공합니다. 
                직관적인 대시보드와 상세한 분석 정보를 통해 효율적인 발주 결정을 지원합니다.
              </p>
              <ul className="space-y-2 text-sm text-slate-600">
                <li className="flex items-start gap-2">
                  <span className="text-purple-500 mt-1">•</span>
                  <span>실시간 데이터 분석</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-500 mt-1">•</span>
                  <span>직관적인 대시보드</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-500 mt-1">•</span>
                  <span>상세한 분석 정보 제공</span>
                </li>
              </ul>
            </div>
          </div>

          {/* 서비스 특징 */}
          <div className="bg-white rounded-xl p-6 md:p-8 shadow-sm border border-slate-200">
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-6">서비스 특징</h2>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">빠른 분석</h3>
                <p className="text-sm text-slate-600">실시간 데이터 기반으로 빠르고 정확한 분석 결과를 제공합니다.</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">신뢰할 수 있는 데이터</h3>
                <p className="text-sm text-slate-600">검증된 매장 데이터를 기반으로 신뢰할 수 있는 분석을 제공합니다.</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">맞춤형 추천</h3>
                <p className="text-sm text-slate-600">각 매장의 특성에 맞는 개인화된 상품 추천을 제공합니다.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}

