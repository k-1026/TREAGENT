// 선택한 시작 위치를 화면 사이에 넘기는 보관소. 메모리에만 두고 저장·로그하지 않는다.
// 좌표를 화면 주소(params)로 넘기면 주소에 남을 수 있어서 이 보관소로 넘긴다.
import { createContext, ReactNode, useContext, useState } from 'react';

export type PickedPlace =
  | { kind: 'gps'; latitude: number; longitude: number }
  | { kind: 'district'; code: string; latitude: number; longitude: number } // 지역 기준점
  | null;

type PlaceValue = { place: PickedPlace; setPlace: (p: PickedPlace) => void };

const PlaceContext = createContext<PlaceValue | null>(null);

export function PlaceProvider({ children }: { children: ReactNode }) {
  const [place, setPlace] = useState<PickedPlace>(null);
  return <PlaceContext.Provider value={{ place, setPlace }}>{children}</PlaceContext.Provider>;
}

export function usePlace(): PlaceValue {
  const value = useContext(PlaceContext);
  if (!value) throw new Error('usePlace는 PlaceProvider 안에서만 쓸 수 있어요');
  return value;
}