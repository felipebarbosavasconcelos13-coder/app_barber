"use client";

import { useEffect } from "react";
import Script from "next/script";

interface GTMProps {
  gtmId?: string | null;
}

export default function GTM({ gtmId }: GTMProps) {
  useEffect(() => {
    if (gtmId) {
      // Inicializa o dataLayer se ele não existir
      window.dataLayer = window.dataLayer || [];
    }
  }, [gtmId]);

  if (!gtmId) return null;

  return (
    <>
      {/* Script do GTM no Head */}
      <Script
        id="gtm-script"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
            new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
            j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
            'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
            })(window,document,'script','dataLayer','${gtmId}');
          `,
        }}
      />
      {/* Noscript do GTM no Body */}
      <noscript>
        <iframe
          src={`https://www.googletagmanager.com/ns.html?id=${gtmId}`}
          height="0"
          width="0"
          style={{ display: "none", visibility: "hidden" }}
        />
      </noscript>
    </>
  );
}

// Extende a interface global do Window para TypeScript não reclamar do dataLayer
declare global {
  interface Window {
    dataLayer: any[];
  }
}
