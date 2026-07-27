import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CN MASTER｜コンピュータネットワークII 学習アプリ",
  description: "授業資料に沿った用語帳・暗記カード・4択クイズで、コンピュータネットワークIIの期末試験対策ができる学習アプリ。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
