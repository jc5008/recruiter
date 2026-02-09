'use client';

import Image from 'next/image';
import Link from 'next/link';

export default function ThankYouPage() {
  return (
    <div className="virtual-interview-page flex flex-col min-h-screen">
      <header className="nav-container grid grid-cols-3 items-center">
        <div className="flex items-center gap-2">
          <Image src="/wvs_logo.png" alt="WV Supply Logo" width={128} height={36} className="shrink-0 w-[128px] h-[36px] object-contain" />
        </div>
        <h1 className="display-title text-center justify-self-center">Virtual Interview</h1>
        <div className="flex-1" />
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-5 py-8">
        <div className="info-card w-full max-w-md p-8 rounded-2xl shadow-md text-center" style={{ background: 'var(--card-bg)', color: 'var(--text-primary)' }}>
          <h2 className="text-xl font-semibold mb-2">Thank you</h2>
          <p className="text-sm sub-text mb-4 leading-relaxed">
            Your interview has been submitted. Our team will review your responses and contact you about next steps.
          </p>
          <p className="text-sm sub-text mb-6 leading-relaxed">
            If you have questions in the meantime, please contact Human Resources at{' '}
            <a href="tel:+13043994568" className="font-medium underline" style={{ color: 'var(--accent-red)' }}>
              (304) 399-4568
            </a>
            .
          </p>
          <Link href="/" className="btn btn-primary inline-block">
            Return to home
          </Link>
        </div>
      </main>
    </div>
  );
}
