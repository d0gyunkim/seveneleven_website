# 세븐일레븐 발주 추천 시스템

점주를 위한 발주 추천 상품 및 제외 상품 안내 웹사이트

## 기술 스택

- Next.js 14
- TypeScript
- Tailwind CSS
- Supabase (연동 예정)

## 시작하기

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 열어 확인하세요.

## 주요 기능

1. 매장 코드 입력
2. 추천 상품 조회
3. 제외 상품 조회

## 프로젝트 구조

```
├── app/
│   ├── layout.tsx          # 루트 레이아웃
│   ├── page.tsx             # 홈 페이지 (매장 코드 입력)
│   └── recommendations/     # 추천 페이지
├── components/
│   └── Layout.tsx           # 공통 레이아웃 (네비게이션 포함)
└── ...
```

