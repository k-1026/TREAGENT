import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AuthError, isAuthRetryableFetchError, type Session } from '@supabase/supabase-js';
import { authLines } from '../content/lines';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

export interface AuthResult {
  ok: boolean;
  message?: string; // 화면에 보여 줄 문구
  needsConfirm?: boolean; // 가입 후 메일 확인이 필요한 경우
}

interface AuthContextValue {
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// 오류 코드는 설치된 @supabase/auth-js 의 error-codes 정의 기준이다.
function toMessage(error: unknown): string {
  if (isAuthRetryableFetchError(error)) return authLines.network;
  if (error instanceof AuthError) {
    switch (error.code) {
      case 'invalid_credentials':
        return authLines.signInFailed;
      case 'email_not_confirmed':
        return authLines.emailNotConfirmed;
      case 'email_exists':
      case 'user_already_exists':
        return authLines.alreadyRegistered;
      case 'weak_password':
        return authLines.weakPassword;
      case 'over_request_rate_limit':
      case 'over_email_send_rate_limit':
        return authLines.rateLimited;
      case 'signup_disabled':
        return authLines.signUpDisabled;
      case 'validation_failed':
        return authLines.emailInvalid;
      default:
        // 가입 시 이미 가입된 이메일은 설정에 따라 코드 없이 메시지만 오기도 한다 [확인 필요]
        if (/already registered/i.test(error.message)) return authLines.alreadyRegistered;
        return authLines.unknown;
    }
  }
  return authLines.network;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return undefined;
    }

    // 앱 시작 시 저장된 세션을 복구한다 (spec F-01: 재실행 후 로그인 유지)
    supabase.auth
      .getSession()
      .then(({ data }) => setSession(data.session))
      .catch(() => setSession(null))
      .finally(() => setLoading(false));

    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { ok: false, message: toMessage(error) };
      return { ok: true };
    } catch (e) {
      return { ok: false, message: toMessage(e) };
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) return { ok: false, message: toMessage(error) };
      // 메일 확인이 켜져 있으면 user는 있고 session은 null이다
      if (!data.session) return { ok: true, needsConfirm: true, message: authLines.confirmMail };
      return { ok: true };
    } catch (e) {
      return { ok: false, message: toMessage(e) };
    }
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value = useMemo(
    () => ({ session, loading, signIn, signUp, signOut }),
    [session, loading, signIn, signUp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
