'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

/**
 * Componente React `InstallEntryPage`.
 * Rota de entrada que detecta o estado de inicialização no cliente e redireciona.
 */
export default function InstallEntryPage() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    
    // Verifica se o aplicativo já está inicializado
    (async () => {
      try {
        const res = await fetch('/api/install/check', { cache: 'no-store' });
        const data = await res.json();
        
        if (!cancelled && data?.initialized === true) {
          // Já configurado: redireciona para o painel administrativo
          router.replace('/admin');
          return;
        }
      } catch (err) {
        console.warn('[install] Erro ao checar inicialização:', err);
      }
      
      // Se não está inicializado, vai para a tela de boas-vindas do instalador
      if (!cancelled) {
        router.replace('/install/start');
      }
    })();
    
    return () => { cancelled = false; };
  }, [router]);

  return (
    <div style={{
      minHeight: 'screen',
      height: '100vh',
      backgroundColor: '#0a0a0a',
      color: '#ffffff',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '12px',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <Loader2 className="animate-spin" style={{ width: '32px', height: '32px', color: '#e5c158' }} />
      <div style={{ fontSize: '14px', color: '#a0a0a0' }}>
        Preparando o assistente de instalação...
      </div>
    </div>
  );
}
