// 내 프로필 보관소. 로그인하면 서버에서 불러오고, 화면들은 useProfile()로 꺼내 쓴다.
//   status: loading(불러오는 중) | ready(프로필 있음) | none(아직 없음 → 첫 만남 화면) | error(불러오지 못함)
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { useAuth } from './auth_context';
import { AgeGroup, ApiResult, checkNicknameAvailable, getProfile, ProfileData, saveProfile } from './server_api';

type Status = 'loading' | 'ready' | 'none' | 'error';
type Loaded = { userId: string; profile: ProfileData | null; status: 'ready' | 'none' | 'error' };

type ProfileValue = {
  profile: ProfileData | null;
  status: Status;
  retry: () => void;
  save: (p: { nickname: string | null; ageGroup: AgeGroup }) => Promise<ApiResult<ProfileData>>;
  check: (nickname: string) => Promise<ApiResult<{ available: boolean }>>;
};

const ProfileContext = createContext<ProfileValue | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const token = session?.access_token;
  const userId = session?.user.id;
  const [data, setData] = useState<Loaded | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!token || !userId) return;
    let cancelled = false;
    getProfile(token).then((r) => {
      if (cancelled) return;
      setData((prev) => {
        if (r.ok) return { userId, profile: r.data, status: 'ready' };
        if (r.error === 'NOT_FOUND') return { userId, profile: null, status: 'none' };
        // 토큰이 갱신되는 중에 실패해도, 이미 불러온 프로필은 그대로 둔다
        return prev?.userId === userId && prev.status === 'ready' ? prev : { userId, profile: null, status: 'error' };
      });
    });
    return () => {
      cancelled = true;
    };
  }, [token, userId, attempt]);

  // 다른 사람이 로그인했을 때 앞 사람의 값이 보이지 않게, 사용자 id가 같을 때만 쓴다
  const current = userId && data?.userId === userId ? data : null;

  const value: ProfileValue = {
    profile: current?.profile ?? null,
    status: current?.status ?? 'loading',
    retry: () => {
      setData(null);
      setAttempt((a) => a + 1);
    },
    save: async (p) => {
      if (!token || !userId) return { ok: false, error: 'UNAUTHORIZED' };
      const r = await saveProfile(token, p);
      if (r.ok) setData({ userId, profile: r.data, status: 'ready' });
      return r;
    },
    check: async (nickname) => {
      if (!token) return { ok: false, error: 'UNAUTHORIZED' };
      return checkNicknameAvailable(token, nickname);
    },
  };

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile(): ProfileValue {
  const value = useContext(ProfileContext);
  if (!value) throw new Error('useProfile은 ProfileProvider 안에서만 쓸 수 있어요');
  return value;
}