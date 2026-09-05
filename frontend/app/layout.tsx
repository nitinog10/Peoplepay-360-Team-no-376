import type { Metadata } from "next";
import { Caveat, Geist_Mono, Inter } from "next/font/google";

import { Providers } from "@/app/providers";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "PeoplePay 360",
    template: "%s · PeoplePay 360",
  },
  description: "HR, attendance, time off and payroll in one connected workspace.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // next-themes writes the `.dark` class onto <html> before paint.
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${caveat.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full min-w-80 flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
