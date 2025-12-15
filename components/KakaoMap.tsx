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
  onStoreDetailClick?: (storeCode: string) => void
  openStoreCode?: string | null // 특정 매장의 InfoWindow를 열기 위한 prop
}

export default function KakaoMap({ stores, currentStoreName, className = '', selectedStore, onStoreDetailClick, openStoreCode }: KakaoMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const [map, setMap] = useState<any>(null)
  const [markers, setMarkers] = useState<any[]>([])
  const [isLoaded, setIsLoaded] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const overlayRef = useRef<any>(null)
  const markerOverlaysRef = useRef<any[]>([])
  const infoWindowsRef = useRef<Map<string, { infoWindow: any, marker: any }>>(new Map())

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

    // 기존 마커 및 오버레이 제거
    markers.forEach((marker) => marker.setMap(null))
    markerOverlaysRef.current.forEach((overlay) => {
      if (overlay) overlay.setMap(null)
    })
    markerOverlaysRef.current = []

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

        // 현재 매장과 유사 매장을 구분하여 색상 설정
        const isCurrentStore = currentStoreInfo && storeInfo.store_nm === currentStoreInfo.store_nm
        const markerColor = isCurrentStore ? '#DC2626' : '#10B981' // 빨간색: 현재 매장, 초록색: 유사 매장

        // 투명한 마커 생성 (위치 참조용, 화면에는 표시 안 함)
        const invisibleMarker = new window.kakao.maps.Marker({
          position: position,
          map: null, // 지도에 표시하지 않음
        })

        // 마커에 store_code 저장 (오버레이 표시용, 문자열로 정규화)
        invisibleMarker.store_code = String(storeInfo.store_code || '')
        invisibleMarker.store_nm = storeInfo.store_nm || ''

        // 인포윈도우 생성 (자세히 보기 버튼 포함)
        const storeCodeForClick = String(storeInfo.store_code || '')
        const infoWindowContent = `
          <div style="padding: 12px; min-width: 200px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
            <div style="font-weight: bold; font-size: 14px; margin-bottom: 6px; color: ${markerColor};">
              ${isCurrentStore ? '현재 매장' : `#${storeInfo.rank} 유사 매장`}
            </div>
            <div style="font-size: 13px; color: #333; margin-bottom: 8px;">
              세븐일레븐 ${storeInfo.store_nm}
            </div>
            <button 
              id="detail-btn-${storeCodeForClick}"
              style="
                width: 100%;
                padding: 8px 12px;
                background: linear-gradient(135deg, ${markerColor} 0%, ${isCurrentStore ? '#B91C1C' : '#059669'} 100%);
                color: white;
                border: none;
                border-radius: 4px;
                font-size: 12px;
                font-weight: 600;
                cursor: pointer;
                transition: opacity 0.2s;
              "
              onmouseover="this.style.opacity='0.9'"
              onmouseout="this.style.opacity='1'"
            >
              자세히 보기
            </button>
          </div>
        `
        
        const infoWindow = new window.kakao.maps.InfoWindow({
          content: infoWindowContent,
        })
        
        // InfoWindow가 열릴 때 버튼 이벤트 리스너 추가
        const originalOpen = infoWindow.open.bind(infoWindow)
        infoWindow.open = function(map: any, marker: any) {
          originalOpen(map, marker)
          // DOM이 렌더링된 후 이벤트 리스너 추가
          setTimeout(() => {
            const button = document.getElementById(`detail-btn-${storeCodeForClick}`)
            if (button && onStoreDetailClick) {
              button.addEventListener('click', (e) => {
                e.stopPropagation()
                onStoreDetailClick(storeCodeForClick)
              })
            }
          }, 100)
        }
        
        // InfoWindow와 마커를 Map에 저장 (나중에 열기 위해)
        infoWindowsRef.current.set(storeCodeForClick, { infoWindow, marker: invisibleMarker })

        // DOM 요소로 직접 생성하여 클릭 이벤트 추가
        const overlayDiv = document.createElement('div')
        overlayDiv.style.cssText = `
          background: white;
          border: 2px solid ${markerColor};
          border-radius: 6px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
          min-width: 120px;
          max-width: 180px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          overflow: hidden;
          cursor: pointer;
        `
        
        const headerDiv = document.createElement('div')
        headerDiv.style.cssText = `
          background: linear-gradient(135deg, ${markerColor} 0%, ${isCurrentStore ? '#B91C1C' : '#059669'} 100%);
          padding: 4px 8px;
          color: white;
        `
        
        const textDiv = document.createElement('div')
        textDiv.style.cssText = `
          font-weight: bold;
          font-size: 11px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        `
        textDiv.textContent = storeInfo.store_nm
        
        headerDiv.appendChild(textDiv)
        overlayDiv.appendChild(headerDiv)
        
        // 클릭 이벤트 추가
        overlayDiv.addEventListener('click', () => {
          infoWindow.open(kakaoMap, invisibleMarker)
        })

        const markerOverlay = new window.kakao.maps.CustomOverlay({
          position: position,
          content: overlayDiv,
          yAnchor: 0.5, // 위치 중앙에 표시
          xAnchor: 0.5,
        })

        markerOverlay.setMap(kakaoMap)
        markerOverlay.marker = invisibleMarker // 마커 참조 저장
        markerOverlay.storeInfo = storeInfo // 매장 정보 저장
        markerOverlaysRef.current.push(markerOverlay)

        newMarkers.push(invisibleMarker)
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
  }, [isLoaded, stores, currentStoreName, onStoreDetailClick])

    // 선택된 매장의 오버레이 강조 표시
  useEffect(() => {
    if (!map || !selectedStore || markerOverlaysRef.current.length === 0) {
      return
    }

    // 선택된 매장의 오버레이 찾기
    const targetStoreCode = String(selectedStore.store_code || '').trim()
    const targetStoreNm = String(selectedStore.store_nm || '').trim()
    
    // 모든 오버레이를 기본 스타일로 복원
    markerOverlaysRef.current.forEach((overlay) => {
      if (overlay && overlay.marker) {
        const marker = overlay.marker
        const markerStoreCode = String(marker.store_code || '').trim()
        const markerStoreNm = String(marker.store_nm || '').trim()
        
        // 선택된 매장인지 확인
        const isSelected = (targetStoreNm && markerStoreNm && targetStoreNm === markerStoreNm) ||
                          (targetStoreCode && markerStoreCode && targetStoreCode === markerStoreCode)
        
        if (!isSelected) {
          // 선택되지 않은 오버레이는 기본 스타일로 복원
          const isCurrentStore = currentStoreName && markerStoreNm === currentStoreName
          const markerColor = isCurrentStore ? '#DC2626' : '#10B981'
          const storeInfo = overlay.storeInfo || { store_nm: markerStoreNm }
          
          // 기본 스타일 DOM 요소 생성
          const defaultDiv = document.createElement('div')
          defaultDiv.style.cssText = `
            background: white;
            border: 2px solid ${markerColor};
            border-radius: 6px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
            min-width: 120px;
            max-width: 180px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            overflow: hidden;
            cursor: pointer;
          `
          
          const headerDiv = document.createElement('div')
          headerDiv.style.cssText = `
            background: linear-gradient(135deg, ${markerColor} 0%, ${isCurrentStore ? '#B91C1C' : '#059669'} 100%);
            padding: 4px 8px;
            color: white;
          `
          
          const textDiv = document.createElement('div')
          textDiv.style.cssText = `
            font-weight: bold;
            font-size: 11px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          `
          textDiv.textContent = storeInfo.store_nm
          
          headerDiv.appendChild(textDiv)
          defaultDiv.appendChild(headerDiv)
          
          // 클릭 이벤트 추가 (자세히 보기 버튼 포함)
          const storeCodeForClick = String(storeInfo.store_code || '')
          const infoWindowContent = `
            <div style="padding: 12px; min-width: 200px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
              <div style="font-weight: bold; font-size: 14px; margin-bottom: 6px; color: ${markerColor};">
                ${isCurrentStore ? '현재 매장' : `#${storeInfo.rank || ''} 유사 매장`}
              </div>
              <div style="font-size: 13px; color: #333; margin-bottom: 8px;">
                세븐일레븐 ${storeInfo.store_nm}
              </div>
              <button 
                id="detail-btn-default-${storeCodeForClick}"
                style="
                  width: 100%;
                  padding: 8px 12px;
                  background: linear-gradient(135deg, ${markerColor} 0%, ${isCurrentStore ? '#B91C1C' : '#059669'} 100%);
                  color: white;
                  border: none;
                  border-radius: 4px;
                  font-size: 12px;
                  font-weight: 600;
                  cursor: pointer;
                  transition: opacity 0.2s;
                "
                onmouseover="this.style.opacity='0.9'"
                onmouseout="this.style.opacity='1'"
              >
                자세히 보기
              </button>
            </div>
          `
          
          const infoWindow = new window.kakao.maps.InfoWindow({
            content: infoWindowContent,
          })
          
          // InfoWindow가 열릴 때 버튼 이벤트 리스너 추가
          const originalOpen = infoWindow.open.bind(infoWindow)
          infoWindow.open = function(map: any, marker: any) {
            originalOpen(map, marker)
            setTimeout(() => {
              const button = document.getElementById(`detail-btn-default-${storeCodeForClick}`)
              if (button && onStoreDetailClick) {
                button.addEventListener('click', (e) => {
                  e.stopPropagation()
                  onStoreDetailClick(storeCodeForClick)
                })
              }
            }, 100)
          }
          
          defaultDiv.addEventListener('click', () => {
            infoWindow.open(map, marker)
          })
          
          overlay.setContent(defaultDiv)
        } else if (isSelected) {
          // 선택된 매장의 오버레이를 더 크게 강조
          const isCurrentStore = currentStoreName && markerStoreNm === currentStoreName
          const markerColor = isCurrentStore ? '#DC2626' : '#10B981'
          
          // 오버레이를 제거하고 다시 추가하여 가장 앞으로 가져오기
          overlay.setMap(null)
          
          // DOM 요소로 강조된 오버레이 생성
          const highlightedDiv = document.createElement('div')
          highlightedDiv.style.cssText = `
            background: white;
            border: 3px solid ${markerColor};
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.25);
            min-width: 180px;
            max-width: 220px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            overflow: hidden;
            cursor: pointer;
            z-index: 1000;
          `
          
          const headerDiv = document.createElement('div')
          headerDiv.style.cssText = `
            background: linear-gradient(135deg, ${markerColor} 0%, ${isCurrentStore ? '#B91C1C' : '#059669'} 100%);
            padding: 8px 12px;
            color: white;
          `
          
          const titleDiv = document.createElement('div')
          titleDiv.style.cssText = `
            font-weight: bold;
            font-size: 13px;
            margin-bottom: 3px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          `
          titleDiv.textContent = `${selectedStore.월기준 || ''} ${selectedStore.store_nm}`
          
          const typeDiv = document.createElement('div')
          typeDiv.style.cssText = `
            font-size: 10px;
            opacity: 0.95;
          `
          typeDiv.textContent = isCurrentStore ? '현재 매장' : '유사 매장'
          
          headerDiv.appendChild(titleDiv)
          headerDiv.appendChild(typeDiv)
          highlightedDiv.appendChild(headerDiv)
          
          // 클릭 이벤트 추가 (자세히 보기 버튼 포함)
          const storeCodeForClick = String(overlay.storeInfo?.store_code || selectedStore.store_code || '')
          const infoWindowContent = `
            <div style="padding: 12px; min-width: 200px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
              <div style="font-weight: bold; font-size: 14px; margin-bottom: 6px; color: ${markerColor};">
                ${isCurrentStore ? '현재 매장' : `#${overlay.storeInfo?.rank || ''} 유사 매장`}
              </div>
              <div style="font-size: 13px; color: #333; margin-bottom: 8px;">
                세븐일레븐 ${selectedStore.store_nm}
              </div>
              <button 
                id="detail-btn-selected-${storeCodeForClick}"
                style="
                  width: 100%;
                  padding: 8px 12px;
                  background: linear-gradient(135deg, ${markerColor} 0%, ${isCurrentStore ? '#B91C1C' : '#059669'} 100%);
                  color: white;
                  border: none;
                  border-radius: 4px;
                  font-size: 12px;
                  font-weight: 600;
                  cursor: pointer;
                  transition: opacity 0.2s;
                "
                onmouseover="this.style.opacity='0.9'"
                onmouseout="this.style.opacity='1'"
              >
                자세히 보기
              </button>
            </div>
          `
          
          const infoWindow = new window.kakao.maps.InfoWindow({
            content: infoWindowContent,
          })
          
          // InfoWindow가 열릴 때 버튼 이벤트 리스너 추가
          const originalOpen = infoWindow.open.bind(infoWindow)
          infoWindow.open = function(map: any, marker: any) {
            originalOpen(map, marker)
            setTimeout(() => {
              const button = document.getElementById(`detail-btn-selected-${storeCodeForClick}`)
              if (button && onStoreDetailClick) {
                button.addEventListener('click', (e) => {
                  e.stopPropagation()
                  onStoreDetailClick(storeCodeForClick)
                })
              }
            }, 100)
          }
          
          highlightedDiv.addEventListener('click', () => {
            infoWindow.open(map, marker)
          })
          
          // 오버레이 content 업데이트
          overlay.setContent(highlightedDiv)
          
          // 오버레이를 다시 지도에 추가 (가장 앞으로)
          overlay.setMap(map)
          
          // 선택된 마커가 화면에 보이도록 지도 이동
          const position = marker.getPosition()
          map.setCenter(position)
          map.setLevel(Math.max(map.getLevel(), 5))
        }
      }
    })
  }, [map, selectedStore, currentStoreName, onStoreDetailClick])

  // openStoreCode가 변경되면 해당 매장의 InfoWindow 열기
  useEffect(() => {
    if (!map || !openStoreCode || infoWindowsRef.current.size === 0) {
      return
    }

    const storeInfo = infoWindowsRef.current.get(String(openStoreCode))
    if (storeInfo) {
      // 기존에 열려있는 InfoWindow 닫기
      infoWindowsRef.current.forEach(({ infoWindow }) => {
        infoWindow.close()
      })
      
      // 해당 매장의 InfoWindow 열기
      storeInfo.infoWindow.open(map, storeInfo.marker)
      
      // 지도 중심을 해당 마커로 이동
      const position = storeInfo.marker.getPosition()
      map.setCenter(position)
      map.setLevel(Math.max(map.getLevel(), 5))
    }
  }, [map, openStoreCode])

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
    <div className={`rounded-lg overflow-hidden border border-gray-200 shadow-lg ${className}`} style={{ position: 'relative', height: '100%' }}>
      <div ref={mapRef} style={{ width: '100%', height: '100%' }}></div>
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

