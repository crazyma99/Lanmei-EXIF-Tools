import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "蓝梅EXIF工具",
  description: "专业且易用的EXIF信息处理工具",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body
        className={`antialiased bg-white text-slate-900`}
      >
        {children}
      </body>
    </html>
  );
}
