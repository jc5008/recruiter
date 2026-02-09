import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Virtual Interview | WV Supply",
  description: "Complete your virtual interview with WV Supply. Speak with an AI interviewer and submit your responses for review.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased flex flex-col min-h-screen`}
      >
        <div className="flex-1 flex flex-col">{children}</div>
        <footer className="flex items-center justify-end px-5 py-3 border-t border-black/06 bg-[var(--card-bg)]">
          <a href="/privacy.html" className="text-sm sub-text hover:opacity-80 underline" target="_blank" rel="noopener noreferrer">
            Privacy
          </a>
        </footer>
      </body>
    </html>
  );
}
