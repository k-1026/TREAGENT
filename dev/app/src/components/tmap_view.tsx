import { useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentType } from 'react';
import { WebView as RNWebView } from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';
import { buildTmapHtml, TmapViewProps } from '../lib/tmap_html';

// react-native-webview 타입이 React 타입과 어긋나는 경우를 피하려고 느슨하게 받는다.
const WebView = RNWebView as unknown as ComponentType<any>;

export function TmapView({ appKey, center, state }: TmapViewProps) {
  const ref = useRef<RNWebView>(null);
  const [ready, setReady] = useState(false);
  const html = useMemo(() => buildTmapHtml(appKey, center), [appKey, center.lat, center.lng]);

  // 지도가 준비되면, 그리고 state가 바뀔 때마다 지도에 전달한다.
  useEffect(() => {
    if (!ready) return;
    ref.current?.injectJavaScript(`window.__apply(${JSON.stringify(state)});true;`);
  }, [ready, state]);

  const onMessage = (e: WebViewMessageEvent) => {
    try {
      if (JSON.parse(e.nativeEvent.data).type === 'ready') setReady(true);
    } catch {}
  };

  return (
    <WebView
      ref={ref}
      originWhitelist={['*']}
      source={{ html, baseUrl: '등록한 주소' }}
      onMessage={onMessage}
      javaScriptEnabled
      style={{ flex: 1 }}
    />
  );
}
