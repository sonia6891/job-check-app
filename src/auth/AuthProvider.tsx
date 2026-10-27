import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { ensureGuestSession, supabase } from '@/src/lib/supabase';
import { billing } from '@/src/lib/billing';

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  setupIssue: 'missing_env' | 'anonymous_auth_unavailable' | null;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  loading: true,
  setupIssue: null,
  refresh: async () => {}
});

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [setupIssue, setSetupIssue] = useState<AuthContextValue['setupIssue']>(null);

  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    setSession(data.session);
  }, []);

  useEffect(() => {
    let mounted = true;

    // 網路不通時 signInAnonymously 可能等很久或丟錯；不管怎樣都要結束載入，畫面才不會卡住。
    (async () => {
      try {
        const guest = await ensureGuestSession();
        if (!mounted) return;
        if (!guest.ok) {
          setSetupIssue(guest.reason);
          const { data } = await supabase.auth.getSession();
          if (mounted) setSession(data.session);
        } else {
          setSession(guest.session);
        }
      } catch {
        if (mounted) setSetupIssue('anonymous_auth_unavailable');
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      // 之後拿到身分了（例如網路恢復），先前的連線問題就不算了。
      if (nextSession) setSetupIssue(null);
      // 訂閱跟著目前的帳號（訪客也算）；購買功能失敗不影響登入。
      if (nextSession?.user) void billing.identify(nextSession.user.id).catch(() => {});
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    session,
    user: session?.user ?? null,
    loading,
    setupIssue,
    refresh
  }), [session, loading, setupIssue, refresh]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
