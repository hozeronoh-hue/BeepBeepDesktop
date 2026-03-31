import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '삑삑삑 | 정보관리기술사 139회 합격 타이머',
  description: '정보관리기술사 139회 시험 합격을 응원하는 반복 타이머 앱.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}
