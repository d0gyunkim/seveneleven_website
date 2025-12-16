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
  전화번호?: string
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
  openStoreCode?: string | null // 특정 매장으로 지도 이동을 위한 prop
  selectedStoreCode?: string | null // 선택된 매장 코드 (다른 매장 숨기기용)
}

export default function KakaoMap({ stores, currentStoreName, className = '', selectedStore, onStoreDetailClick, openStoreCode, selectedStoreCode }: KakaoMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const [map, setMap] = useState<any>(null)
  const [markers, setMarkers] = useState<any[]>([])
  const [isLoaded, setIsLoaded] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const overlayRef = useRef<any>(null)
  const markerOverlaysRef = useRef<any[]>([])
  // InfoWindow 제거됨 - 더 이상 사용하지 않음

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
      if (overlay && overlay.customOverlay) {
        overlay.customOverlay.setMap(null)
      }
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
        if (markerOverlaysRef.current.length > 0) {
          try {
            // bounds 객체가 제대로 초기화되었고, isEmpty() 메서드를 사용하여 확인
            if (typeof bounds.isEmpty === 'function' && !bounds.isEmpty()) {
              kakaoMap.setBounds(bounds, 50) // 패딩 추가
            } else if (markerOverlaysRef.current.length > 0) {
              // bounds가 비어있으면 첫 번째 마커로 이동
              const firstOverlay = markerOverlaysRef.current[0]
              if (firstOverlay && firstOverlay.getPosition) {
                const position = firstOverlay.getPosition()
                if (position) {
                  kakaoMap.setCenter(position)
                  kakaoMap.setLevel(8)
                }
              }
            }
          } catch (error) {
            console.warn('지도 범위 설정 실패:', error)
            // 범위 설정 실패 시 첫 번째 마커로 이동
            if (markerOverlaysRef.current.length > 0) {
              try {
                const firstOverlay = markerOverlaysRef.current[0]
                if (firstOverlay && firstOverlay.getPosition) {
                  const position = firstOverlay.getPosition()
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

        // 모든 마커를 초록색으로 설정
        const markerColor = '#10B981' // 초록색

        // 선택된 매장인지 확인
        const isSelected = selectedStoreCode && String(storeInfo.store_code) === String(selectedStoreCode)
        // selectedStoreCode가 있을 때만 다른 마커를 작게 표시
        const isSmall = selectedStoreCode ? (!isSelected) : false

        // InfoWindow 제거 - 더 이상 사용하지 않음
        const storeCodeForClick = String(storeInfo.store_code || '')
        
        // 마커 크기 결정
        const markerHeight = isSmall ? 32 : isSelected ? 48 : 40
        const markerWidth = isSmall ? 120 : isSelected ? 180 : 150
        
        // 커스텀 오버레이로 마커 생성 (둥근 사각형 레이블)
        const overlayDiv = document.createElement('div')
        overlayDiv.style.cssText = `
          background: ${markerColor} !important;
          border-radius: 20px;
          padding: 6px 12px;
          display: flex;
          align-items: center;
          gap: 8px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.2);
          cursor: pointer;
          min-width: ${markerWidth}px;
          height: ${markerHeight}px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          opacity: ${isSmall ? '0.8' : '1'};
          transform: ${isSmall ? 'scale(0.85)' : 'scale(1)'};
          transition: all 0.2s;
          z-index: ${isSelected ? '1000' : isSmall ? '1' : '100'};
          position: relative;
        `
        
        // 왼쪽: 세븐일레븐 로고 영역
        const logoContainer = document.createElement('div')
        logoContainer.style.cssText = `
          width: ${markerHeight - 12}px;
          height: ${markerHeight - 12}px;
          background: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        `
        
        // 오른쪽: 매장명
        const nameDiv = document.createElement('div')
        nameDiv.style.cssText = `
          color: white;
          font-weight: bold;
          font-size: ${isSmall ? '12px' : isSelected ? '16px' : '14px'};
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: ${markerWidth - markerHeight - 20}px;
        `
        nameDiv.textContent = storeInfo.store_nm || ''
        
        overlayDiv.appendChild(logoContainer)
        overlayDiv.appendChild(nameDiv)
        
        // 클릭 이벤트 추가 - 매장 상세 모달 열기
        overlayDiv.addEventListener('click', () => {
          if (onStoreDetailClick) {
            onStoreDetailClick(storeCodeForClick)
          }
        })
        
        // 커스텀 오버레이 생성
        const customOverlay = new window.kakao.maps.CustomOverlay({
          position: position,
          content: overlayDiv,
          yAnchor: 1,
          xAnchor: 0.5,
          zIndex: isSelected ? 1000 : isSmall ? 1 : 100,
        })
        
        // 지도에 마커 표시
        if (kakaoMap) {
          customOverlay.setMap(kakaoMap)
        }
        
        // 로고 이미지 (모든 매장에 표시)
        const logoImg = document.createElement('img')
        logoImg.style.cssText = `
          width: ${markerHeight - 16}px;
          height: ${markerHeight - 16}px;
          object-fit: contain;
          border-radius: 50%;
        `
        logoImg.crossOrigin = 'anonymous'
        logoImg.src = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSP183RdOwZQBayUC0G_6lbwxwQ2LgWvBJktw&s'
        logoImg.onerror = () => {
          // 이미지 로드 실패 시 빈 원으로 표시
          logoContainer.style.background = 'white'
        }
        logoContainer.appendChild(logoImg)
        
        // 투명한 마커 생성 (참조용)
        const invisibleMarker = new window.kakao.maps.Marker({
          position: position,
          map: null,
        })
        
        const marker = invisibleMarker
        
        // 마커에 정보 저장
        invisibleMarker.store_code = String(storeInfo.store_code || '')
        invisibleMarker.store_nm = storeInfo.store_nm || ''

        const markerOverlay = {
          marker: invisibleMarker,
          customOverlay: customOverlay,
          storeInfo: storeInfo,
          isSelected: isSelected,
          isSmall: isSmall,
          markerWidth: markerWidth,
          markerHeight: markerHeight,
          markerColor: markerColor,
          setMap: (map: any) => {
            if (map) {
              customOverlay.setMap(map)
            } else {
              customOverlay.setMap(null)
            }
          },
          setContent: () => {},
          getPosition: () => position
        }

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
  }, [isLoaded, stores, currentStoreName, onStoreDetailClick, selectedStoreCode])

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
          const markerColor = '#10B981' // 초록색
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
            background: linear-gradient(135deg, ${markerColor} 0%, #059669 100%);
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
          const storeAddress = (storeInfo as any).address || ''
          const storePhone = (storeInfo as any).전화번호 || ''
          const infoWindowContent = `
            <div style="padding: 24px; min-width: 320px; max-width: 380px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
              <div style="font-weight: bold; font-size: 22px; margin-bottom: 20px; color: #000; line-height: 1.6;">
                ${storeInfo.store_nm}
                </div>
              ${storeAddress ? `
              <div style="font-size: 15px; color: #333; margin-bottom: 16px; line-height: 1.8;">
                ${storeAddress}
                </div>
              ` : ''}
              ${storePhone ? `
              <div style="font-size: 15px; color: #333; margin-bottom: 20px; display: flex; align-items: center; gap: 8px; line-height: 1.6;">
                <span style="color: #999; font-size: 16px;">📞</span>
                <span>${storePhone}</span>
              </div>
              ` : ''}
              <button 
                id="detail-btn-default-${storeCodeForClick}"
                style="
                  width: 100%;
                  padding: 14px 20px;
                  background: linear-gradient(135deg, ${markerColor} 0%, #059669 100%);
                  color: white;
                  border: none;
                  border-radius: 8px;
                  font-size: 15px;
                  font-weight: 700;
                  cursor: pointer;
                  transition: opacity 0.2s;
                  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
                  margin-top: 4px;
                "
                onmouseover="this.style.opacity='0.9'; this.style.transform='translateY(-1px)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.2)'"
                onmouseout="this.style.opacity='1'; this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 8px rgba(0,0,0,0.15)'"
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
          const markerColor = '#10B981' // 초록색
          
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
            background: linear-gradient(135deg, ${markerColor} 0%, #059669 100%);
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
          typeDiv.textContent = '유사 매장'
          
          headerDiv.appendChild(titleDiv)
          headerDiv.appendChild(typeDiv)
          highlightedDiv.appendChild(headerDiv)
          
          // 클릭 이벤트 추가 (자세히 보기 버튼 포함)
          const storeCodeForClick = String(overlay.storeInfo?.store_code || selectedStore.store_code || '')
          const storeAddress = (overlay.storeInfo as any)?.address || ''
          const storePhone = (overlay.storeInfo as any)?.전화번호 || ''
          const infoWindowContent = `
            <div style="padding: 24px; min-width: 320px; max-width: 380px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
              <div style="font-weight: bold; font-size: 22px; margin-bottom: 20px; color: #000; line-height: 1.6;">
                ${selectedStore.store_nm}
                </div>
              ${storeAddress ? `
              <div style="font-size: 15px; color: #333; margin-bottom: 16px; line-height: 1.8;">
                ${storeAddress}
                </div>
              ` : ''}
              ${storePhone ? `
              <div style="font-size: 15px; color: #333; margin-bottom: 20px; display: flex; align-items: center; gap: 8px; line-height: 1.6;">
                <span style="color: #999; font-size: 16px;">📞</span>
                <span>${storePhone}</span>
              </div>
              ` : ''}
              <button 
                id="detail-btn-selected-${storeCodeForClick}"
                style="
                  width: 100%;
                  padding: 14px 20px;
                  background: linear-gradient(135deg, ${markerColor} 0%, #059669 100%);
                  color: white;
                  border: none;
                  border-radius: 8px;
                  font-size: 15px;
                  font-weight: 700;
                  cursor: pointer;
                  transition: opacity 0.2s;
                  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
                  margin-top: 4px;
                "
                onmouseover="this.style.opacity='0.9'; this.style.transform='translateY(-1px)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.2)'"
                onmouseout="this.style.opacity='1'; this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 8px rgba(0,0,0,0.15)'"
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

  // openStoreCode가 변경되면 해당 매장으로 지도 이동
  useEffect(() => {
    if (!map || !openStoreCode || markerOverlaysRef.current.length === 0) {
      return
    }

    const targetOverlay = markerOverlaysRef.current.find((overlay) => {
      if (overlay && overlay.storeInfo) {
        return String(overlay.storeInfo.store_code) === String(openStoreCode)
      }
      return false
    })

    if (targetOverlay && targetOverlay.getPosition) {
      const position = targetOverlay.getPosition()
      if (position) {
        map.setCenter(position)
        map.setLevel(Math.max(map.getLevel(), 5))
      }
    }
  }, [map, openStoreCode])

  // selectedStoreCode가 변경되면 다른 매장 마커 작게 표시
  useEffect(() => {
    if (!map || markerOverlaysRef.current.length === 0) {
      return
    }

    markerOverlaysRef.current.forEach((overlay) => {
      if (overlay && overlay.customOverlay && overlay.storeInfo) {
        const markerStoreCode = String(overlay.storeInfo.store_code || '')
        const isSelected = selectedStoreCode && markerStoreCode === String(selectedStoreCode)
        const isSmall = selectedStoreCode && !isSelected
        
        // 마커 크기 결정
        const newMarkerHeight = isSmall ? 32 : isSelected ? 48 : 40
        const newMarkerWidth = isSmall ? 120 : isSelected ? 180 : 150
        const markerColor = '#10B981' // 초록색
        
        // 기존 마커 크기와 다르면 새로 생성
        if (overlay.markerHeight !== newMarkerHeight || overlay.markerWidth !== newMarkerWidth || overlay.isSelected !== isSelected) {
          // 기존 오버레이 제거
          overlay.customOverlay.setMap(null)
          
          // 새로운 오버레이 생성
          const overlayDiv = document.createElement('div')
          overlayDiv.style.cssText = `
            background: ${markerColor};
            border-radius: 20px;
            padding: 6px 12px;
            display: flex;
            align-items: center;
            gap: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            cursor: pointer;
            min-width: ${newMarkerWidth}px;
            height: ${newMarkerHeight}px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            opacity: ${isSmall ? '0.8' : '1'};
            transform: ${isSmall ? 'scale(0.85)' : 'scale(1)'};
            transition: all 0.2s;
          `
          
          // 왼쪽: 세븐일레븐 로고 영역
          const logoContainer = document.createElement('div')
          logoContainer.id = `logo-container-update-${markerStoreCode}`
          logoContainer.style.cssText = `
            width: ${newMarkerHeight - 12}px;
            height: ${newMarkerHeight - 12}px;
            background: white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
          `
          
          // 로고 이미지 (모든 매장에 표시)
          const logoImg = document.createElement('img')
          logoImg.style.cssText = `
            width: ${newMarkerHeight - 16}px;
            height: ${newMarkerHeight - 16}px;
            object-fit: contain;
            border-radius: 50%;
          `
          logoImg.crossOrigin = 'anonymous'
          logoImg.src = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSP183RdOwZQBayUC0G_6lbwxwQ2LgWvBJktw&s'
          logoImg.onerror = () => {
            // 이미지 로드 실패 시 빈 원으로 표시
            logoContainer.style.background = 'white'
          }
          logoContainer.appendChild(logoImg)
          
          // 오른쪽: 매장명
          const nameDiv = document.createElement('div')
          nameDiv.style.cssText = `
            color: white;
            font-weight: bold;
            font-size: ${isSmall ? '12px' : isSelected ? '16px' : '14px'};
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: ${newMarkerWidth - newMarkerHeight - 20}px;
          `
          nameDiv.textContent = overlay.storeInfo.store_nm || ''
          
          overlayDiv.appendChild(logoContainer)
          overlayDiv.appendChild(nameDiv)
          
          // 클릭 이벤트 추가 - 매장 상세 모달 열기
          overlayDiv.addEventListener('click', () => {
            if (onStoreDetailClick) {
              onStoreDetailClick(markerStoreCode)
            }
          })
          
          // 새로운 커스텀 오버레이 생성
          const newCustomOverlay = new window.kakao.maps.CustomOverlay({
            position: overlay.getPosition(),
            content: overlayDiv,
            yAnchor: 0.5,
            xAnchor: 0,
          })
          
          newCustomOverlay.setMap(map)
          
          // 오버레이 정보 업데이트
          overlay.customOverlay = newCustomOverlay
          overlay.markerHeight = newMarkerHeight
          overlay.markerWidth = newMarkerWidth
          overlay.markerColor = markerColor
          overlay.isSelected = isSelected
          overlay.isSmall = isSmall
        }
      }
    })
  }, [map, selectedStoreCode, currentStoreName])

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

