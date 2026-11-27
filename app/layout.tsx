import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
const inter = localFont({ src: '../node_modules/@fontsource/inter/files/inter-latin-400-normal.woff2', variable: '--font-inter', display: 'swap' });
export const metadata: Metadata = { title: 'SkyJet', description: 'Prenez votre envol avec SkyJet, un jeu de crash fictif.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="fr"><body className={inter.variable}>{children}</body></html>; }
