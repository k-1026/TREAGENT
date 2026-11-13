import { AppState, Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { createClient } from '@supabase/supabase-js';

// 앱에는 anon(public) 키만 넣는다. service_role 키는 앱에 넣지 않는다 (.env.example 참고).
const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const isSupabaseConfigured = url.length > 0 && anonKey.length > 0;

// 세션 토큰은 기기 보안 저장소에 둔다 (spec F-01).
// 세션 JSON이 길 수 있어 조각으로 나눠 저장한다. 값 크기 제한은 확인하지 못해 보수적으로 나눈다 [확인 필요].
const CHUNK_SIZE = 1000;

async function removeChunks(key: string) {
  const countRaw = await SecureStore.getItemAsync(`${key}.n`);
  if (countRaw !== null) {
    const count = Number(countRaw);
    for (let i = 0; i < count; i += 1) {
      await SecureStore.deleteItemAsync(`${key}.${i}`);
    }
  }
  await SecureStore.deleteItemAsync(`${key}.n`);
}

const nativeStorage = {
  async getItem(key: string): Promise<string | null> {
    const countRaw = await SecureStore.getItemAsync(`${key}.n`);
    if (countRaw === null) return null;
    const parts: string[] = [];
    for (let i = 0; i < Number(countRaw); i += 1) {
      const part = await SecureStore.getItemAsync(`${key}.${i}`);
      if (part === null) return null;
      parts.push(part);
    }
    return parts.join('');
  },
  async setItem(key: string, value: string): Promise<void> {
    await removeChunks(key);
    const chunks: string[] = [];
    for (let i = 0; i < value.length; i += CHUNK_SIZE) {
      chunks.push(value.slice(i, i + CHUNK_SIZE));
    }
    for (let i = 0; i < chunks.length; i += 1) {
      await SecureStore.setItemAsync(`${key}.${i}`, chunks[i]);
    }
    await SecureStore.setItemAsync(`${key}.n`, String(chunks.length));
  },
  async removeItem(key: string): Promise<void> {
    await removeChunks(key);
  },
};

// 웹 미리보기용. 보안 저장소가 아니므로 시험용으로만 쓴다.
const webStorage = {
  async getItem(key: string): Promise<string | null> {
    try {
      return typeof window === 'undefined' ? null : window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  async setItem(key: string, value: string): Promise<void> {
    try {
      if (typeof window !== 'undefined') window.localStorage.setItem(key, value);
    } catch {
      // 저장 실패 시 세션 유지만 안 되고 로그인 자체는 동작한다
    }
  },
  async removeItem(key: string): Promise<void> {
    try {
      if (typeof window !== 'undefined') window.localStorage.removeItem(key);
    } catch {
      // 무시
    }
  },
};

// 환경 변수가 없어도 앱이 죽지 않게 자리표시 값을 쓴다. 이 경우 화면에서 설정 안내를 보여 준다.
export const supabase = createClient(
  isSupabaseConfigured ? url : 'http://localhost:54321',
  isSupabaseConfigured ? anonKey : 'not-configured',
  {
    auth: {
      storage: Platform.OS === 'web' ? webStorage : nativeStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);

// 앱이 화면에 보일 때만 토큰을 자동 갱신한다.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
