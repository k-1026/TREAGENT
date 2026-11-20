import { createContext, ReactNode, useContext, useState } from 'react';
import type { TodayPrefs, TodayResult } from './server_api';

type TodayValue = {
  prefs: TodayPrefs | null;
  result: TodayResult | null;
  rounds: number; // "다른 길 새로 불러오기"를 누른 횟수 (0이면 첫 묶음)
  chosen: number | null; // 고른 후보의 번호 (result.routes 안의 위치)
  set: (v: { prefs: TodayPrefs; result: TodayResult; rounds: number }) => void;
  choose: (index: number | null) => void;
};

const TodayContext = createContext<TodayValue | null>(null);

export function TodayProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<TodayPrefs | null>(null);
  const [result, setResult] = useState<TodayResult | null>(null);
  const [rounds, setRounds] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);

  const set = (v: { prefs: TodayPrefs; result: TodayResult; rounds: number }) => {
    setPrefs(v.prefs);
    setResult(v.result);
    setRounds(v.rounds);
    setChosen(null);
  };

  return (
    <TodayContext.Provider value={{ prefs, result, rounds, chosen, set, choose: setChosen }}>
      {children}
    </TodayContext.Provider>
  );
}

export function useToday(): TodayValue {
  const value = useContext(TodayContext);
  if (!value) throw new Error('useToday는 TodayProvider 안에서만 쓸 수 있어요');
  return value;
}