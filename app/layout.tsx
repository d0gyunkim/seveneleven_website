import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '세븐일레븐 발주 추천 시스템',
  description: '점주를 위한 발주 추천 상품 및 제외 상품 안내',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}

