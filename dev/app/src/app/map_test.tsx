import { useMemo } from 'react';
import { SafeAreaView } from 'react-native';
import { TmapView } from '../components/tmap_view';
import { MapState } from '../lib/tmap_html';

const APP_KEY = process.env.EXPO_PUBLIC_TMAP_APP_KEY ?? '';

// 임시 좌표입니다. 실제 장소가 아니고 대구 중구 부근으로 가정한 값이에요.
const PLACES = [
  { id: 't1', name: '임시1', lat: 35.870, lng: 128.593 },
  { id: 't2', name: '임시2', lat: 35.869, lng: 128.596 },
  { id: 't3', name: '임시3', lat: 35.867, lng: 128.598 },
];

export default function MapTest() {
  // state를 useMemo로 고정해야 렌더마다 지도를 다시 그리지 않아요.
  const state = useMemo<MapState>(
    () => ({ places: PLACES, path: PLACES.map(({ lat, lng }) => ({ lat, lng })), me: null }),
    [],
  );
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <TmapView appKey={APP_KEY} center={{ lat: 35.869, lng: 128.596 }} state={state} />
    </SafeAreaView>
  );
}