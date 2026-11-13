import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import 'leaflet/dist/leaflet.css';
import './globals.css';
import UiHost from '@/components/UiHost';

const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-inter', display: 'swap' });

export const metadata: Metadata = {
  title: 'Orbi Portal',
  description: 'Orbi para empresas: acompanhamento de rotas, ocorrências e relatórios da operação de entregas.',
  icons: { icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48'%3E%3Crect width='48' height='48' rx='12' fill='%232557D6'/%3E%3Ccircle cx='24' cy='24' r='8' fill='white'/%3E%3Cellipse cx='24' cy='24' rx='18' ry='7' fill='none' stroke='white' stroke-width='3' transform='rotate(-25 24 24)'/%3E%3C/svg%3E" }
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#FFFFFF' };

// aplica o tema salvo antes da primeira pintura (evita piscar claro→escuro)
const themeScript = `try{var t=localStorage.getItem('orbi-portal-theme')||'auto';var d=t==='dark'||(t==='auto'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light'}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.variable} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body>{children}<UiHost /></body>
    </html>
  );
}
