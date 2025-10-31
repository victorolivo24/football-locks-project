import type { Metadata } from 'next';
import { Outfit, Lexend_Mega } from 'next/font/google';
import './globals.css';
import { MotionProvider } from '@/components/motion/MotionProvider';
import { AmbientScene } from '@/components/fx/AmbientScene';

const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit' });
const lexend = Lexend_Mega({ subsets: ['latin'], weight: ['400', '600', '700'], variable: '--font-lexend-mega' });

export const metadata: Metadata = {
  title: "NFL Pick'em",
  description: 'Weekly NFL Pick\'em for friends',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${outfit.variable} ${lexend.variable} font-sans min-h-screen antialiased`}>
        <MotionProvider>
          <AmbientScene />
          <div className="relative z-[10]">{children}</div>
        </MotionProvider>
      </body>
    </html>
  );
}
