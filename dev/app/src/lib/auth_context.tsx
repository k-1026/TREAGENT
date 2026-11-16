/*
 * [auth_context.tsx] 로그인 상태 보관소
 *
 * 역할
 *  - 앱 전체가 "지금 로그인했는가"를 같은 값으로 알 수 있게 한다.
 *
 * 들고 있는 값 (useAuth()로 꺼내 쓴다)
 *  - session : 로그인 정보. 로그인하지 않았으면 null
 *  - loading : 저장된 세션을 읽는 중이면 true
 *              (읽기 전에 null을 로그아웃으로 오해하지 않게 하려는 값)
 *
 * 동작 순서
 *  1) 앱이 켜지면 getSession()으로 저장된 세션을 읽는다.
 *  2) 이후 로그인, 로그아웃, 토큰 갱신은 onAuthStateChange()로 알림을 받는다.
 *  3) 화면이 사라질 때 구독을 해제한다 (알림이 계속 남는 것을 막는다).
 *
 * 사용 위치: _layout.tsx에서 앱 전체를 <AuthProvider>로 감싼다.
 */
import { createContext, useContext, useEffect, useState } from 'react';
/* import type { ReactNode } from 'react'; */
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

const AuthContext = createContext<{ session: Session | null; loading: boolean }>({
  session: null,
  loading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return <AuthContext.Provider value={{ session, loading }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);