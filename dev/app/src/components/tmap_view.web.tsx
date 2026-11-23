import { useEffect, useMemo, useRef, useState } from 'react';
import { buildTmapHtml, TmapViewProps } from '../lib/tmap_html';

export function TmapView({ appKey, center, state }: TmapViewProps) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const html = useMemo(() => buildTmapHtml(appKey, center), [appKey, center.lat, center.lng]);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.source !== ref.current?.contentWindow) return;
      try {
        if (JSON.parse(e.data).type === 'ready') setReady(true);
      } catch {}
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  useEffect(() => {
    if (ready) ref.current?.contentWindow?.postMessage(JSON.stringify(state), '*');
  }, [ready, state]);

  return <iframe ref={ref} srcDoc={html} style={{ border: 0, width: '100%', height: '100%' }} />;
}