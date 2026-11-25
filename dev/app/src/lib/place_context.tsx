// 선택한 시작 위치를 화면 사이에 넘기는 보관소. 메모리에만 두고 저장·로그하지 않는다.
// 좌표를 화면 주소(params)로 넘기면 주소에 남을 수 있어서 이 보관소로 넘긴다.
import { createContext, ReactNode, useContext, useState } from 'react';
import { DISTRICTS } from './districts';

export type PickedPlace =
  | { kind: 'gps'; latitude: number; longitude: number }
  | { kind: 'district'; code: string; latitude: number; longitude: number } // 지역 기준점
  | null;

type PlaceValue = { place: PickedPlace; setPlace: (p: PickedPlace) => void };

const PlaceContext = createContext<PlaceValue | null>(null);

// 처음 위치: 중구 기준점 (MVP는 중구만 안내, districts.ts). 홈이 열릴 때 정하던 값을 처음부터 넣어 둔다.
// 그래서 주소로 바로 열거나 새로고침해도 모든 길·오늘의 길이 "위치를 먼저 정해 주세요"로 막히지 않는다.
// 기준점은 구의 대표 좌표이고 사용자 위치가 아니다. 이 값도 저장하거나 로그에 남기지 않는다.
function defaultPlace(): PickedPlace {
  const jung = DISTRICTS.find((d) => d.code === 'jung');
  return jung?.center ? { kind: 'district', code: jung.code, ...jung.center } : null;
}

export function PlaceProvider({ children }: { children: ReactNode }) {
  const [place, setPlace] = useState<PickedPlace>(defaultPlace);
  return <PlaceContext.Provider value={{ place, setPlace }}>{children}</PlaceContext.Provider>;
}

export function usePlace(): PlaceValue {
  const value = useContext(PlaceContext);
  if (!value) throw new Error('usePlace는 PlaceProvider 안에서만 쓸 수 있어요');
  return value;
}
