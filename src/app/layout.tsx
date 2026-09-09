import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "意难平 IF",
  description: "在锁定事实与约束内寻找另一条可信的故事分支",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
