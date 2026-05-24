import { type ReactNode } from 'react';
import Sidebar from './Sidebar';

interface Props {
  children: ReactNode;
  bgImage?: string;
}

export default function DashboardLayout({ children, bgImage }: Props) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#1a0a2e', position: 'relative' }}>
      {bgImage && (
        <>
          <img src={bgImage} alt="" style={{ position: 'fixed', inset: 0, width: '100%', height: '100%',
            objectFit: 'cover', objectPosition: 'center', zIndex: 0, pointerEvents: 'none' }} />
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(6,1,16,0.74)', zIndex: 1, pointerEvents: 'none' }} />
        </>
      )}
      <Sidebar glassy={!!bgImage} />
      <main style={{ position: 'relative', zIndex: 2, flex: 1, marginLeft: 240,
        padding: '32px 28px', minHeight: '100vh', overflowY: 'auto' }}>
        {children}
      </main>
    </div>
  );
}
