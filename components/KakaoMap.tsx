'use client'

import { useEffect, useRef, useState } from 'react'

declare global {
  interface Window {
    kakao: any
  }
}

interface StoreLocation {
  store_code: string
  store_nm: string
  rank: number
  address?: string
  latitude?: number
  longitude?: number
}

interface SelectedStoreInfo {
  store_code: string
  store_nm: string
  월기준?: string
}

interface KakaoMapProps {
  stores: StoreLocation[]
  currentStoreName?: string
  className?: string
  selectedStore?: SelectedStoreInfo | null
}

export default function KakaoMap({ stores, currentStoreName, className = '', selectedStore }: KakaoMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const [map, setMap] = useState<any>(null)
  const [markers, setMarkers] = useState<any[]>([])
  const [isLoaded, setIsLoaded] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const overlayRef = useRef<any>(null)

  // 카카오맵 스크립트 로드
  useEffect(() => {
    const script = document.createElement('script')
    script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${process.env.NEXT_PUBLIC_KAKAO_MAP_API_KEY}&libraries=services&autoload=false`
    script.async = true
    script.onload = () => {
      if (window.kakao) {
        window.kakao.maps.load(() => {
          setIsLoaded(true)
        })
      }
    }
    document.head.appendChild(script)

    return () => {
      document.head.removeChild(script)
    }
  }, [])

  // 지도 초기화 및 마커 생성
  useEffect(() => {
    if (!isLoaded || !mapRef.current || stores.length === 0) return

    // 지도 초기화 (기본 위치: 서울 시청)
    const defaultPosition = new window.kakao.maps.LatLng(37.5665, 126.9780)
    const mapOption = {
      center: defaultPosition,
      level: 8,
    }

    const kakaoMap = new window.kakao.maps.Map(mapRef.current, mapOption)
    setMap(kakaoMap)

    // 기존 마커 제거
    markers.forEach((marker) => marker.setMap(null))

    const geocoder = new window.kakao.maps.services.Geocoder()
    const newMarkers: any[] = []
    const bounds = new window.kakao.maps.LatLngBounds()
    let completedSearches = 0
    const totalStores = stores.length

    // 현재 매장 정보
    const currentStoreInfo = currentStoreName ? { store_nm: currentStoreName } : null

    setIsSearching(true)

    const checkCompletion = () => {
      completedSearches++
      if (completedSearches >= totalStores) {
        setIsSearching(false)
        // 모든 마커가 추가되면 지도 범위 조정
        if (newMarkers.length > 0) {
          try {
            // bounds 객체가 제대로 초기화되었고, isEmpty() 메서드를 사용하여 확인
            if (typeof bounds.isEmpty === 'function' && !bounds.isEmpty()) {
              kakaoMap.setBounds(bounds)
            } else if (newMarkers.length > 0) {
              // bounds가 비어있으면 첫 번째 마커로 이동
              const firstMarker = newMarkers[0]
              if (firstMarker && typeof firstMarker.getPosition === 'function') {
                const position = firstMarker.getPosition()
                if (position) {
                  kakaoMap.setCenter(position)
                  kakaoMap.setLevel(8)
                }
              }
            }
          } catch (error) {
            console.warn('지도 범위 설정 실패:', error)
            // 범위 설정 실패 시 첫 번째 마커로 이동
            if (newMarkers.length > 0) {
              try {
                const firstMarker = newMarkers[0]
                if (firstMarker && typeof firstMarker.getPosition === 'function') {
                  const position = firstMarker.getPosition()
                  if (position) {
                    kakaoMap.setCenter(position)
                    kakaoMap.setLevel(8)
                  }
                }
              } catch (e) {
                console.error('마커 위치 설정 실패:', e)
              }
            }
          }
        }
      }
    }

    stores.forEach((store, index) => {
      const createMarker = (lat: number, lng: number, storeInfo: StoreLocation) => {
        const position = new window.kakao.maps.LatLng(lat, lng)
        bounds.extend(position)

        // 현재 매장과 유사 매장을 구분하여 마커 색상 설정
        const isCurrentStore = currentStoreInfo && storeInfo.store_nm === currentStoreInfo.store_nm
        const markerColor = isCurrentStore ? '#DC2626' : '#10B981' // 빨간색: 현재 매장, 초록색: 유사 매장
        const markerSize = isCurrentStore ? 64 : 50

        // 커스텀 마커 이미지 생성
        const rankText = String(storeInfo.rank || index + 1)
        const svgString = `<svg width="${markerSize}" height="${markerSize}" xmlns="http://www.w3.org/2000/svg"><circle cx="${markerSize / 2}" cy="${markerSize / 2}" r="${markerSize / 2 - 2}" fill="${markerColor}" stroke="white" stroke-width="3"/><text x="${markerSize / 2}" y="${markerSize / 2 + 5}" text-anchor="middle" fill="white" font-size="14" font-weight="bold">${rankText}</text></svg>`
        const svgBase64 = btoa(unescape(encodeURIComponent(svgString)))
        
        const markerImage = new window.kakao.maps.MarkerImage(
          `data:image/svg+xml;base64,${svgBase64}`,
          new window.kakao.maps.Size(markerSize, markerSize),
          { offset: new window.kakao.maps.Point(markerSize / 2, markerSize) }
        )

        const marker = new window.kakao.maps.Marker({
          position: position,
          image: markerImage,
          map: kakaoMap,
        })

        // 인포윈도우 생성
        const infoWindow = new window.kakao.maps.InfoWindow({
          content: `
            <div style="padding: 8px; min-width: 150px;">
              <div style="font-weight: bold; font-size: 14px; margin-bottom: 4px; color: ${markerColor};">
                ${isCurrentStore ? '현재 매장' : `#${storeInfo.rank} 유사 매장`}
              </div>
              <div style="font-size: 13px; color: #333;">
                세븐일레븐 ${storeInfo.store_nm}
              </div>
            </div>
          `,
        })

        // 마커 클릭 이벤트
        window.kakao.maps.event.addListener(marker, 'click', () => {
          infoWindow.open(kakaoMap, marker)
        })

        // 마커에 store_code 저장 (오버레이 표시용)
        marker.store_code = storeInfo.store_code
        marker.store_nm = storeInfo.store_nm

        newMarkers.push(marker)
      }

      // 위도/경도가 있으면 바로 사용
      if (store.latitude && store.longitude) {
        createMarker(store.latitude, store.longitude, store)
        checkCompletion()
      } else if (store.address) {
        // 주소가 있으면 주소로 좌표 검색
        geocoder.addressSearch(store.address, (result: any[], status: string) => {
          if (status === window.kakao.maps.services.Status.OK) {
            createMarker(parseFloat(result[0].y), parseFloat(result[0].x), store)
            checkCompletion()
          } else {
            console.warn(`주소 검색 실패: ${store.address}`)
            // 주소 검색 실패 시 매장명으로 재검색
            geocoder.keywordSearch(`세븐일레븐 ${store.store_nm}`, (result: any[], status: string) => {
              if (status === window.kakao.maps.services.Status.OK && result.length > 0) {
                createMarker(parseFloat(result[0].y), parseFloat(result[0].x), store)
              }
              checkCompletion()
            })
          }
        })
      } else {
        // 주소와 좌표가 없으면 매장명으로 검색
        geocoder.keywordSearch(`세븐일레븐 ${store.store_nm}`, (result: any[], status: string) => {
          if (status === window.kakao.maps.services.Status.OK && result.length > 0) {
            createMarker(parseFloat(result[0].y), parseFloat(result[0].x), store)
          } else {
            console.warn(`매장 검색 실패: ${store.store_nm}`)
          }
          checkCompletion()
        })
      }
    })

    setMarkers(newMarkers)
  }, [isLoaded, stores, currentStoreName])

  // 선택된 매장에 대한 오버레이 표시
  useEffect(() => {
    if (!map || !selectedStore || markers.length === 0) {
      // 기존 오버레이 제거
      if (overlayRef.current) {
        overlayRef.current.setMap(null)
        overlayRef.current = null
      }
      return
    }

    // 선택된 매장의 마커 찾기
    const selectedMarker = markers.find(
      (marker) => marker.store_code === selectedStore.store_code
    )

    if (!selectedMarker) {
      // 마커를 찾을 수 없으면 오버레이 제거
      if (overlayRef.current) {
        overlayRef.current.setMap(null)
        overlayRef.current = null
      }
      return
    }

    // 기존 오버레이 제거
    if (overlayRef.current) {
      overlayRef.current.setMap(null)
    }

    // 커스텀 오버레이 생성
    const position = selectedMarker.getPosition()
    
    // 현재 매장인지 확인
    const isCurrentStore = currentStoreName && selectedStore.store_nm === currentStoreName
    
    // 오버레이 HTML 생성 (탭 형식)
    const content = `
      <div style="
        background: white;
        border: 2px solid #10B981;
        border-radius: 8px;
        box-shadow: 0 4px 16px rgba(0,0,0,0.2);
        min-width: 240px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        overflow: hidden;
      ">
        <div style="
          background: linear-gradient(135deg, #10B981 0%, #059669 100%);
          padding: 12px 16px;
          color: white;
        ">
          <div style="
            font-weight: bold;
            font-size: 16px;
            margin-bottom: 4px;
          ">
            ${selectedStore.월기준 || ''} ${selectedStore.store_nm}
          </div>
          <div style="
            font-size: 11px;
            opacity: 0.9;
          ">
            ${isCurrentStore ? '현재 매장' : '유사 매장'}
          </div>
        </div>
        <div style="
          padding: 10px 16px;
          background: #f9fafb;
          border-top: 1px solid #e5e7eb;
          font-size: 12px;
          color: #6b7280;
        ">
          상세 정보는 아래에서 확인하세요
        </div>
      </div>
    `

    const customOverlay = new window.kakao.maps.CustomOverlay({
      position: position,
      content: content,
      yAnchor: 2.2, // 마커 위에 표시
      xAnchor: 0.5,
    })

    customOverlay.setMap(map)
    overlayRef.current = customOverlay

    // 마커가 화면에 보이도록 지도 이동
    map.setCenter(position)
    map.setLevel(Math.max(map.getLevel(), 5))

    // 정리 함수
    return () => {
      if (overlayRef.current) {
        overlayRef.current.setMap(null)
        overlayRef.current = null
      }
    }
  }, [map, selectedStore, markers, stores, currentStoreName])

  if (!isLoaded) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 rounded-lg ${className}`} style={{ minHeight: '400px' }}>
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-green-500 mb-4"></div>
          <p className="text-gray-600">지도를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`rounded-lg overflow-hidden border border-gray-200 shadow-lg ${className}`} style={{ position: 'relative' }}>
      <div ref={mapRef} style={{ width: '100%', height: '500px' }}></div>
      {isSearching && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255, 255, 255, 0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, borderRadius: '8px' }}>
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mb-2"></div>
            <p className="text-sm text-gray-600">매장 위치를 찾는 중...</p>
          </div>
        </div>
      )}
      <div className="bg-white p-3 border-t border-gray-200">
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-red-500"></div>
            <span className="text-gray-700">현재 매장</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-green-500"></div>
            <span className="text-gray-700">유사 매장</span>
          </div>
          {isSearching && (
            <div className="ml-auto text-xs text-gray-500">
              위치 검색 중...
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

