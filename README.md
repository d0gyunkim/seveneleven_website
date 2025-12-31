# 세븐일레븐 발주 추천 시스템

점주를 위한 발주 추천 상품 및 제외 상품 안내 웹 애플리케이션

## 📋 목차

- [기술 스택](#기술-스택)
- [프로젝트 구조](#프로젝트-구조)
- [시작하기](#시작하기)
- [주요 기능](#주요-기능)
- [폴더별 상세 설명](#폴더별-상세-설명)

---

## 🛠 기술 스택

### 프레임워크 및 언어

- **Next.js 14.0.4** - React 기반 풀스택 프레임워크 (App Router 사용)
- **TypeScript 5** - 정적 타입 검사
- **React 18.2.0** - UI 라이브러리
- **React DOM 18.2.0** - React DOM 렌더링

### 스타일링

- **Tailwind CSS 3.3.0** - 유틸리티 기반 CSS 프레임워크
- **PostCSS 8** - CSS 후처리기
- **Autoprefixer 10.0.1** - CSS 벤더 프리픽스 자동 추가

### 데이터베이스 및 백엔드

- **Supabase 2.39.0** - PostgreSQL 기반 백엔드 서비스 (데이터베이스 및 인증)

### 지도 및 시각화

- **Leaflet 1.9.4** - 오픈소스 지도 라이브러리
- **React Leaflet 4.2.1** - React용 Leaflet 래퍼
- **Kakao Maps API** - 카카오 지도 API (컴포넌트에서 사용)

### 차트 및 데이터 시각화

- **Recharts 3.5.0** - React용 차트 라이브러리
  - RadarChart, BarChart, LineChart, PieChart 등 다양한 차트 지원

### PWA (Progressive Web App)

- **next-pwa 5.6.0** - Next.js용 PWA 플러그인
  - 오프라인 지원
  - 모바일 앱처럼 설치 가능

### 배포

- **Netlify** - 정적 사이트 호스팅 및 배포
  - Next.js 플러그인 사용
  - Node.js 18 환경

### 외부 API

- **OpenAI API** - AI 기반 분석 텍스트 생성 (GPT-4o-mini 사용)

---

## 📁 프로젝트 구조

```
seven_eleven_agent/
├── app/                          # Next.js App Router 디렉토리
│   ├── api/                      # API 라우트
│   │   └── analyze-similarity/   # 유사도 분석 API
│   │       └── route.ts          # OpenAI API를 통한 분석 텍스트 생성
│   ├── overview/                 # 서비스 개요 페이지
│   │   └── page.tsx              # 대시보드 및 통계 페이지
│   ├── recommendations/          # 추천/부진 상품 페이지
│   │   └── page.tsx              # 추천 상품 및 부진 상품 조회
│   ├── similar-stores/           # 유사 매장 리포팅 페이지
│   │   └── page.tsx              # 유사 매장 분석 및 지도 표시
│   ├── layout.tsx                # 루트 레이아웃 (메타데이터, 폰트 설정)
│   ├── page.tsx                  # 홈 페이지 (매장 코드 로그인)
│   ├── error.tsx                 # 에러 페이지
│   ├── global-error.tsx          # 글로벌 에러 핸들러
│   ├── not-found.tsx             # 404 페이지
│   └── globals.css               # 전역 스타일
├── components/                   # 재사용 가능한 React 컴포넌트
│   ├── Layout.tsx                # 공통 레이아웃 (네비게이션, 헤더, 푸터)
│   └── KakaoMap.tsx              # 카카오 지도 컴포넌트
├── lib/                          # 유틸리티 및 설정 파일
│   ├── supabase.ts               # Supabase 클라이언트 설정
│   └── storeUtils.ts             # 매장 관련 유틸리티 함수
├── public/                       # 정적 파일
│   ├── manifest.json             # PWA 매니페스트
│   ├── sw.js                     # Service Worker
│   ├── workbox-*.js              # Workbox (PWA 오프라인 지원)
│   └── *.png                     # 이미지 파일들
├── venv/                         # Python 가상환경 (데이터 처리용)
├── package.json                  # Node.js 의존성 및 스크립트
├── tsconfig.json                 # TypeScript 설정
├── next.config.js                # Next.js 설정 (이미지 도메인 등)
├── tailwind.config.ts            # Tailwind CSS 설정
├── postcss.config.js             # PostCSS 설정
├── netlify.toml                  # Netlify 배포 설정
└── README.md                     # 프로젝트 문서
```

---

## 🚀 시작하기

### 사전 요구사항

- Node.js 18 이상
- npm 또는 yarn
- Supabase 계정 및 프로젝트
- (선택) Kakao Maps API 키
- (선택) OpenAI API 키

### 설치 및 실행

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev

# 프로덕션 빌드
npm run build

# 프로덕션 서버 실행
npm run start

# 린트 검사
npm run lint
```

개발 서버는 기본적으로 [http://localhost:3000](http://localhost:3000)에서 실행됩니다.

### 환경 변수 설정

`.env.local` 파일을 생성하고 다음 환경 변수를 설정하세요:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_KEY=your_supabase_key

# Kakao Maps API (선택)
NEXT_PUBLIC_KAKAO_MAP_API_KEY=your_kakao_map_api_key

# OpenAI API (선택 - 분석 텍스트 생성용)
OPENAI_API_KEY=your_openai_api_key
```

---

## ✨ 주요 기능

### 1. 매장 코드 로그인 (`app/page.tsx`)
- 5자리 숫자 매장 코드 입력
- Supabase에서 매장 존재 여부 확인
- 세션 스토리지에 매장 코드 저장
- 로그인 후 개요 페이지로 이동

### 2. 서비스 개요 (`app/overview/page.tsx`)
- 매장 통계 및 대시보드
- 판매 패턴 분석
- 시간대별 판매 패턴
- 주중/주말 판매 패턴
- 차트 및 시각화 데이터 표시

### 3. 추천/부진 상품 (`app/recommendations/page.tsx`)
- **추천 상품 탭**: 유사 매장에서 잘 팔리는 상품 추천
- **부진 상품 탭**: 판매가 부진한 상품 목록
- 상품 이미지, 가격, 추천 이유 표시
- 카테고리별 그룹화
- 무한 스크롤 또는 페이지네이션

### 4. 유사 매장 리포팅 (`app/similar-stores/page.tsx`)
- 유사 매장 목록 및 유사도 점수
- 카카오 지도에 매장 위치 표시
- 매장별 상세 분석
- 판매 패턴 비교 차트
- 매장 상세 정보 모달

### 5. AI 기반 분석 (`app/api/analyze-similarity/route.ts`)
- OpenAI GPT-4o-mini를 활용한 분석 텍스트 생성
- 판매 패턴, 시간대 패턴, 주중주말 패턴 분석
- 전문적이고 자연스러운 설명 생성

---

## 📂 폴더별 상세 설명

### `/app` - Next.js App Router

Next.js 14의 App Router를 사용하는 메인 애플리케이션 디렉토리입니다. 모든 페이지와 API 라우트가 이 디렉토리 내에 파일 기반 라우팅으로 구성되어 있습니다.

#### `/app/api` - API 라우트

**역할**: 서버 사이드 API 엔드포인트를 제공하는 디렉토리입니다.

**구조**:
```
app/api/
└── analyze-similarity/
    └── route.ts
```

**파일 상세**:

- **`analyze-similarity/route.ts`**
  - **기능**: OpenAI API를 활용한 AI 기반 분석 텍스트 생성
  - **HTTP 메서드**: POST
  - **요청 본문**:
    ```typescript
    {
      analysisType: '판매패턴' | '시간대패턴' | '주중주말패턴',
      data: {
        // 분석 타입에 따른 데이터 구조
      }
    }
    ```
  - **주요 로직**:
    - 분석 타입에 따라 프롬프트 생성
    - OpenAI GPT-4o-mini 모델 호출
    - 전문적이고 자연스러운 분석 텍스트 반환
  - **지원 분석 타입**:
    - `판매패턴`: 카테고리별 판매 비율 비교 분석
    - `시간대패턴`: 시간대별 판매 패턴 분석 (주중/주말)
    - `주중주말패턴`: 주중과 주말의 판매 비율 비교 분석
  - **응답 형식**:
    ```typescript
    {
      analysis: string // 생성된 분석 텍스트
    }
    ```

#### `/app/overview` - 서비스 개요 페이지

**역할**: 매장의 전체적인 통계와 분석 데이터를 한눈에 볼 수 있는 대시보드 페이지입니다.

**파일 상세**:

- **`page.tsx`** (약 2,098줄)
  - **컴포넌트 타입**: Client Component (`'use client'`)
  - **주요 기능**:
    1. **매장 정보 표시**
       - 현재 매장명 및 코드 표시
       - 매장 기본 정보 조회
    2. **추천 상품 프리뷰**
       - 상위 추천 상품 15개 표시
       - 자동 캐러셀 (3초 간격)
       - 상품 이미지, 이름, 추천 점수 표시
    3. **부진 상품 프리뷰**
       - 상위 부진 상품 15개 표시
       - 자동 캐러셀 (3초 간격)
       - 부진 이유 표시
    4. **서비스 소개 섹션**
       - 유사 매장 선정 기준 설명 모달
       - Rolling Window 알고리즘 설명 모달
       - 동적 상권 포착 설명 모달
    5. **반응형 디자인**
       - 모바일/데스크톱 UI 분기
       - PWA 앱 환경 감지
       - 모바일 프리뷰 페이지 전환
  - **주요 State 관리**:
    ```typescript
    - topRecommendedProducts: Product[] // 상위 추천 상품
    - topUnderperformingProducts: Product[] // 상위 부진 상품
    - recommendedIndex: number // 추천 상품 캐러셀 인덱스
    - underperformingIndex: number // 부진 상품 캐러셀 인덱스
    - showCriteriaModal: boolean // 기준 모달 표시 여부
    - isMobile: boolean // 모바일 환경 여부
    - isApp: boolean // PWA 앱 환경 여부
    ```
  - **데이터 페칭**:
    - Supabase에서 매장별 추천/부진 상품 테이블 조회
    - 매장명 기반 동적 테이블명 생성 (`{매장명}_추천상품`, `{매장명}_부진재고`)
  - **애니메이션**:
    - Intersection Observer를 활용한 스크롤 애니메이션
    - Fade-in 효과
  - **네비게이션**:
    - 추천/부진 상품 클릭 시 해당 페이지로 이동
    - URL 파라미터로 `storeCode` 전달

#### `/app/recommendations` - 추천/부진 상품 페이지

**역할**: 추천 상품과 부진 상품을 상세히 조회할 수 있는 페이지입니다.

**파일 상세**:

- **`page.tsx`** (약 2,559줄)
  - **컴포넌트 타입**: Client Component (`'use client'`)
  - **주요 기능**:
    1. **탭 기반 네비게이션**
       - `recommended` 탭: 추천 상품 목록
       - `excluded` 탭: 부진 상품 목록
       - URL 쿼리 파라미터로 탭 상태 관리 (`?tab=recommended` 또는 `?tab=excluded`)
    2. **상품 목록 표시**
       - 카테고리별 그룹화 (대분류 → 중분류)
       - 무한 스크롤 또는 페이지네이션
       - 상품 이미지, 이름, 가격, 추천 이유 표시
    3. **필터링 기능**
       - 대분류 필터 (과자, 냉장, 맥주, 면, 미반, 빵, 음료)
       - 중분류 다중 선택 필터
       - 필터 조합에 따른 동적 필터링
    4. **상품 상세 모달**
       - 상품 기본 정보 (이름, 이미지, 가격, 카테고리)
       - 추천 이유 또는 부진 이유
       - RFM 점수 정보 (Recency, Frequency, Monetary)
       - 예측 점수 (pred_score, pred_rfm)
    5. **점수 가이드 모달**
       - 추천 점수 산정 기준 설명
       - RFM 분석 설명
    6. **반응형 디자인**
       - 모바일/데스크톱 레이아웃 분기
       - 모바일에서 카드 형태, 데스크톱에서 그리드 형태
  - **주요 State 관리**:
    ```typescript
    - recommendedProducts: Product[] // 추천 상품 목록
    - excludedProducts: Product[] // 부진 상품 목록
    - selectedProduct: Product | null // 선택된 상품
    - selectedLargeCategory: string | null // 선택된 대분류
    - selectedMiddleCategories: string[] // 선택된 중분류들
    - visibleItems: Set<string> // 보이는 아이템 추적 (무한 스크롤용)
    - productDetailTab: 'info' | 'reason' // 상품 상세 모달 탭
    ```
  - **데이터 페칭**:
    - URL 또는 sessionStorage에서 `storeCode` 가져오기
    - 매장명 기반 동적 테이블명 생성
    - Supabase에서 상품 데이터 조회 및 정렬
  - **성능 최적화**:
    - `useMemo`를 활용한 필터링된 상품 목록 메모이제이션
    - `useCallback`을 활용한 함수 메모이제이션
    - 무한 스크롤을 통한 점진적 로딩

#### `/app/similar-stores` - 유사 매장 리포팅 페이지

**역할**: 유사 매장 목록, 지도 표시, 상세 분석을 제공하는 페이지입니다.

**파일 상세**:

- **`page.tsx`** (약 2,535줄)
  - **컴포넌트 타입**: Client Component (`'use client'`)
  - **주요 기능**:
    1. **유사 매장 목록**
       - 유사도 점수 순으로 정렬
       - 매장명, 주소, 전화번호, 유사도 점수 표시
       - 매장 클릭 시 상세 분석 모달 열기
    2. **카카오 지도 통합**
       - `KakaoMap` 컴포넌트 사용
       - 현재 매장 및 유사 매장 위치 표시
       - 매장 클릭 시 지도에서 해당 위치로 이동
       - 선택된 매장 강조 표시
    3. **매장 상세 분석 모달**
       - **근거 탭**: 유사도 근거 설명
       - **인기상품 탭**: 해당 매장의 인기 상품 목록
       - 월별 데이터 선택 (드롭다운)
       - 카테고리별 판매 패턴 차트
    4. **판매 패턴 비교**
       - 현재 매장 vs 선택된 유사 매장 비교
       - Radar Chart로 카테고리별 판매 비율 비교
       - Bar Chart로 상세 비교
    5. **시간대 패턴 분석**
       - 주중/주말 시간대별 판매 패턴 비교
       - Line Chart로 시간대별 트렌드 표시
       - AI 기반 분석 텍스트 표시
    6. **주중/주말 패턴 분석**
       - 주중과 주말의 판매 비율 비교
       - Pie Chart로 비율 시각화
       - AI 기반 분석 텍스트 표시
    7. **평균 비교 기능**
       - 현재 매장 vs 유사 매장 평균 비교
       - 주중/주말 탭 전환
       - 시간대별 평균 비교 차트
  - **주요 State 관리**:
    ```typescript
    - similarStores: SimilarStore[] // 유사 매장 목록
    - selectedStore: StoreDetail | null // 선택된 매장 상세 정보
    - selectedCategory: CategoryType // 선택된 카테고리
    - selectedMonth: string // 선택된 월
    - timePatternTab: '주중' | '주말' // 시간대 패턴 탭
    - storeDetailTab: '근거' | '인기상품' // 매장 상세 모달 탭
    - openStoreCode: string | null // 지도에서 열 매장 코드
    - selectedStoreCode: string | null // 선택된 매장 코드
    - currentStorePatterns: {...} // 현재 매장의 패턴 데이터
    - similarStoresPatterns: Array<{...}> // 유사 매장들의 패턴 데이터
    ```
  - **데이터 페칭**:
    - 유사 매장 목록 조회 (Supabase)
    - 매장별 월별 데이터 조회
    - 패턴 데이터 조회 (판매패턴, 시간대패턴, 주중주말패턴)
    - AI 분석 텍스트 생성 (`/api/analyze-similarity` 호출)
  - **차트 라이브러리**:
    - Recharts 사용 (RadarChart, BarChart, LineChart, PieChart)
    - 반응형 차트 (ResponsiveContainer)
  - **지도 연동**:
    - `KakaoMap` 컴포넌트에 매장 목록 전달
    - 매장 선택 시 지도에서 해당 위치로 이동
    - 매장 상세 모달과 지도 동기화

#### 루트 파일들

**`layout.tsx`**
- **역할**: 애플리케이션의 루트 레이아웃 컴포넌트
- **주요 기능**:
  - HTML 구조 정의 (`<html>`, `<body>`)
  - 메타데이터 설정 (SEO, PWA)
  - 폰트 설정 (Noto Sans KR)
  - 전역 스타일 적용
- **메타데이터 설정**:
  ```typescript
  - title: '세븐일레븐 발주 추천 시스템'
  - description: '점주를 위한 발주 추천 상품 및 제외 상품 안내'
  - manifest: '/manifest.json' // PWA 매니페스트
  - appleWebApp: {...} // iOS PWA 설정
  - theme-color: '#22c55e' // 테마 색상
  ```
- **Viewport 설정**:
  - 모바일 최적화 (user-scalable: false)
  - viewport-fit: cover (노치 디스플레이 지원)

**`page.tsx`**
- **역할**: 홈 페이지 (매장 코드 로그인)
- **컴포넌트 타입**: Client Component (`'use client'`)
- **주요 기능**:
  1. **매장 코드 입력**
     - 5자리 숫자만 입력 가능
     - 실시간 입력 검증
  2. **매장 코드 검증**
     - Supabase `매장마스터` 테이블에서 존재 여부 확인
     - 숫자/문자열 형식 모두 지원
  3. **로그인 처리**
     - 검증 성공 시 `sessionStorage`에 저장
     - `/overview` 페이지로 리다이렉트
  4. **에러 처리**
     - 매장 코드 미입력 에러
     - 형식 오류 에러
     - 존재하지 않는 매장 에러
- **State 관리**:
  ```typescript
  - storeCode: string // 입력된 매장 코드
  - error: string // 에러 메시지
  - loading: boolean // 로딩 상태
  ```

**`error.tsx`**
- **역할**: 에러 바운더리 컴포넌트
- **기능**: 페이지 레벨 에러 처리 및 표시

**`global-error.tsx`**
- **역할**: 글로벌 에러 핸들러
- **기능**: 루트 레이아웃 레벨의 에러 처리

**`not-found.tsx`**
- **역할**: 404 페이지
- **기능**: 존재하지 않는 경로 접근 시 표시

**`globals.css`**
- **역할**: 전역 CSS 스타일
- **내용**: Tailwind CSS 기본 스타일, 커스텀 CSS 변수

### `/components` - 재사용 가능한 컴포넌트

공통으로 사용되는 React 컴포넌트들을 모아놓은 디렉토리입니다.

#### `Layout.tsx`

**역할**: 애플리케이션 전체에 공통으로 적용되는 레이아웃 컴포넌트입니다.

**컴포넌트 타입**: Client Component (`'use client'`)

**주요 기능**:

1. **네비게이션 바**
   - 데스크톱: 상단 가로 네비게이션 바
   - 모바일: 하단 고정 네비게이션 바
   - 현재 페이지 하이라이트
   - 링크에 `storeCode` 파라미터 자동 추가

2. **헤더**
   - 로고 이미지 표시
   - 모바일/데스크톱 스타일 분기

3. **매장 정보 표시**
   - 상단 유틸리티 바에 매장명 및 코드 표시
   - 데스크톱: 호버 시 상세 정보 툴팁
   - 모바일: 간단한 정보 표시

4. **로그아웃 기능**
   - 세션 스토리지 초기화
   - 홈 페이지로 리다이렉트

5. **반응형 디자인**
   - 모바일 감지 (화면 크기 + User Agent)
   - 모바일: 하단 네비게이션 바 (아이콘 + 텍스트)
   - 데스크톱: 상단 네비게이션 바 (텍스트 링크)

**주요 State 관리**:
```typescript
- isMenuOpen: boolean // 모바일 메뉴 열림 상태
- storeCode: string | null // 현재 매장 코드
- storeName: string | null // 현재 매장명
- isMobile: boolean // 모바일 환경 여부
```

**데이터 페칭**:
- URL 또는 sessionStorage에서 `storeCode` 가져오기
- Supabase에서 매장명 조회
- 알려진 매장명 목록 순회하며 테이블 검색

**네비게이션 항목**:
- 서비스 개요 (`/overview`)
- 추천 상품 (`/recommendations?tab=recommended`)
- 부진 상품 (`/recommendations?tab=excluded`)
- 유사 매장 리포팅 (`/similar-stores`)

#### `KakaoMap.tsx`

**역할**: 카카오 지도 API를 활용한 지도 컴포넌트입니다.

**컴포넌트 타입**: Client Component (`'use client'`)

**주요 기능**:

1. **지도 초기화**
   - 카카오 지도 스크립트 동적 로드
   - 기본 위치: 서울 시청 (37.5665, 126.9780)
   - 지도 레벨: 8

2. **매장 마커 표시**
   - 커스텀 오버레이로 마커 생성
   - 매장명과 로고 표시
   - 초록색 배경의 둥근 사각형 레이블
   - 선택된 매장은 더 크게 표시

3. **주소 검색 및 좌표 변환**
   - 카카오 지도 Geocoder API 사용
   - 주소 → 좌표 변환
   - 주소 없으면 매장명으로 키워드 검색

4. **매장 선택 및 강조**
   - 선택된 매장 마커 크기 증가
   - 선택된 매장 위치로 지도 이동
   - z-index 조정으로 선택된 마커를 앞에 표시

5. **매장 상세 정보**
   - 마커 클릭 시 InfoWindow 표시
   - 매장명, 주소, 전화번호 표시
   - "자세히 보기" 버튼으로 상세 모달 열기

6. **로딩 상태**
   - 지도 로딩 중 스피너 표시
   - 주소 검색 중 오버레이 표시

**Props 인터페이스**:
```typescript
interface KakaoMapProps {
  stores: StoreLocation[] // 표시할 매장 목록
  currentStoreName?: string // 현재 매장명
  className?: string // 추가 CSS 클래스
  selectedStore?: SelectedStoreInfo | null // 선택된 매장 정보
  onStoreDetailClick?: (storeCode: string) => void // 매장 상세 클릭 핸들러
  openStoreCode?: string | null // 특정 매장으로 지도 이동
  selectedStoreCode?: string | null // 선택된 매장 코드
}
```

**주요 State 관리**:
```typescript
- map: any // 카카오 지도 인스턴스
- markers: any[] // 마커 배열
- isLoaded: boolean // 지도 로드 완료 여부
- isSearching: boolean // 주소 검색 중 여부
- markerOverlaysRef: any[] // 커스텀 오버레이 참조
```

**성능 최적화**:
- 주소 검색 비동기 처리
- 마커 생성 완료 후 지도 범위 자동 조정
- 기존 마커 제거 후 새로 생성 (메모리 관리)

### `/lib` - 유틸리티 및 설정

공통으로 사용되는 유틸리티 함수와 설정 파일들을 모아놓은 디렉토리입니다.

#### `supabase.ts`

**역할**: Supabase 클라이언트 인스턴스를 생성하고 export하는 설정 파일입니다.

**주요 기능**:
- Supabase 클라이언트 생성
- 환경 변수에서 URL 및 키 로드
- 전역에서 사용 가능한 클라이언트 export

**코드 구조**:
```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '기본값'
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_KEY || '기본값'

export const supabase = createClient(supabaseUrl, supabaseKey)
```

**사용 방법**:
- 다른 파일에서 `import { supabase } from '@/lib/supabase'`로 import
- `supabase.from('테이블명').select()` 형태로 사용

#### `storeUtils.ts`

**역할**: 매장 관련 유틸리티 함수를 제공하는 파일입니다.

**주요 함수**:

1. **`getTableNames(storeCode: string, storeName?: string)`**
   - 매장 코드와 매장명으로 테이블명 생성
   - 반환값:
     ```typescript
     {
       recommendedTable: string // '{매장명}_추천상품'
       excludedTable: string // '{매장명}_부진재고'
     }
     ```
   - 현재는 기본 구조만 제공 (실제 구현 필요)

2. **`findStoreTables(storeCode: string)`**
   - 매장 코드로 해당하는 테이블 찾기
   - 알려진 매장명 목록 순회
   - 반환값:
     ```typescript
     {
       recommendedTable: string | null
       excludedTable: string | null
       storeName: string | null
     }
     ```
   - 현재는 기본 구조만 제공 (실제 구현 필요)

**참고**: 현재 이 파일의 함수들은 기본 구조만 제공되며, 실제 프로젝트에서는 매장 코드와 매장명 매핑 로직이 필요합니다.

### `/public` - 정적 파일

빌드 시 그대로 복사되는 정적 파일들을 저장하는 디렉토리입니다.

**파일 목록**:

- **`manifest.json`**
  - PWA 매니페스트 파일
  - 앱 이름, 아이콘, 테마 색상 등 설정
  - 모바일에서 "홈 화면에 추가" 기능 지원

- **`sw.js`**
  - Service Worker 스크립트
  - 오프라인 지원
  - 캐시 전략 관리

- **`workbox-*.js`**
  - Workbox 라이브러리 파일
  - PWA 오프라인 기능 지원
  - 자동 생성되는 파일

- **이미지 파일들** (`*.png`)
  - 로고 이미지
  - 스크린샷 이미지
  - 기타 정적 이미지 리소스

### 설정 파일들

#### `package.json`

**역할**: Node.js 프로젝트의 메타데이터와 의존성을 관리하는 파일입니다.

**주요 내용**:
- 프로젝트 이름, 버전
- npm 스크립트 정의:
  - `dev`: 개발 서버 실행
  - `build`: 프로덕션 빌드
  - `start`: 프로덕션 서버 실행
  - `lint`: ESLint 검사
- 의존성 목록 (dependencies, devDependencies)

#### `tsconfig.json`

**역할**: TypeScript 컴파일러 설정 파일입니다.

**주요 설정**:
- 타겟: ES5
- 모듈 시스템: ESNext
- JSX: preserve (Next.js가 처리)
- 경로 별칭: `@/*` → 프로젝트 루트
- 엄격 모드 활성화
- Next.js 플러그인 사용

#### `next.config.js`

**역할**: Next.js 프레임워크 설정 파일입니다.

**주요 설정**:
- React Strict Mode 활성화
- 이미지 도메인 허용 목록:
  - `www.7-eleven.co.kr` (세븐일레븐 이미지)
  - 모든 HTTP/HTTPS 도메인 (개발용)

#### `tailwind.config.ts`

**역할**: Tailwind CSS 설정 파일입니다.

**주요 설정**:
- 컨텐츠 경로: `./app/**/*.{js,ts,jsx,tsx,mdx}`, `./components/**/*.{js,ts,jsx,tsx,mdx}`
- 커스텀 색상: `background`, `foreground` (CSS 변수 사용)
- 커스텀 폰트: `Noto Sans KR`

#### `postcss.config.js`

**역할**: PostCSS 설정 파일입니다.

**주요 설정**:
- Tailwind CSS 플러그인
- Autoprefixer 플러그인

#### `netlify.toml`

**역할**: Netlify 배포 설정 파일입니다.

**주요 설정**:
- 빌드 명령어: `npm run build`
- 출력 디렉토리: `.next`
- Node.js 버전: 18
- Next.js 플러그인 사용

---

## 🔧 주요 기술 특징

### 1. App Router 구조
- Next.js 14의 최신 App Router 사용
- 서버 컴포넌트 및 클라이언트 컴포넌트 분리
- 파일 기반 라우팅

### 2. 반응형 디자인
- 모바일 우선 설계
- Tailwind CSS를 통한 반응형 레이아웃
- 모바일/데스크톱 UI 분기 처리

### 3. PWA 지원
- Service Worker를 통한 오프라인 지원
- 모바일 앱처럼 설치 가능
- 매니페스트 파일 설정

### 4. 데이터 시각화
- Recharts를 활용한 다양한 차트
- RadarChart, BarChart, LineChart, PieChart 등

### 5. 지도 통합
- 카카오 지도 API 통합
- 커스텀 마커 및 오버레이
- 주소 검색 및 좌표 변환

### 6. AI 통합
- OpenAI API를 통한 분석 텍스트 생성
- 판매 패턴 분석 자동화

---

## 📝 데이터베이스 구조

Supabase를 사용하며, 주요 테이블 구조는 다음과 같습니다:

- `매장마스터`: 매장 기본 정보
- `{매장명}_추천상품`: 매장별 추천 상품 데이터
- `{매장명}_부진재고`: 매장별 부진 상품 데이터
- 기타 분석 데이터 테이블들

---

## 🚢 배포

### Netlify 배포

1. Netlify에 프로젝트 연결
2. 빌드 설정은 `netlify.toml`에 정의됨
3. 환경 변수 설정 필요
4. 자동 배포 설정 가능

### 빌드 명령어

```bash
npm run build
```

빌드 결과물은 `.next` 디렉토리에 생성됩니다.

---

## 📄 라이선스

이 프로젝트는 비공개 프로젝트입니다.

---

## 👥 기여

프로젝트 관련 문의사항이 있으시면 이슈를 등록해주세요.
