import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  getUserProfileUseCase,
  signInUseCase,
  signOutUseCase,
  signUpUseCase
} from '../../application/usecases/authUseCases';
import { supabase } from '../../infrastructure/supabase/supabaseClient';
import { hasSupabaseConfig } from '../../core/config/env';
import { normalizeRole } from '../../core/constants/roles';

const AuthContext = createContext(null);
let initialSessionRequest = null;
const AUTH_BOOTSTRAP_TIMEOUT_MS = 8000;

function isLockStealAbortError(error) {
  return (
    error?.name === 'AbortError' &&
    typeof error?.message === 'string' &&
    error.message.includes("Lock broken by another request with the 'steal' option")
  );
}

function isAuthBootstrapTimeoutError(error) {
  return error?.name === 'AuthBootstrapTimeoutError';
}

function withTimeout(promise, timeoutMs) {
  let timeoutId;

  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      const timeoutError = new Error(`Auth bootstrap exceeded ${timeoutMs}ms.`);
      timeoutError.name = 'AuthBootstrapTimeoutError';
      reject(timeoutError);
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId);
  });
}

function resolveRole(currentUser) {
  if (!currentUser) {
    return null;
  }

  return normalizeRole(currentUser.user_metadata?.role ?? currentUser.app_metadata?.role);
}

async function getInitialSession() {
  if (!supabase) {
    return null;
  }

  if (!initialSessionRequest) {
    initialSessionRequest = supabase.auth
      .getSession()
      .then(({ data: { session: initialSession } }) => initialSession)
      .finally(() => {
        initialSessionRequest = null;
      });
  }

  return initialSessionRequest;
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hasSupabaseConfig || !supabase) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    const syncProfile = async (currentUser) => {
      if (!currentUser) {
        if (isMounted) {
          setRole(null);
        }
        return;
      }

      try {
        const profile = await getUserProfileUseCase(currentUser.id);
        if (isMounted) {
          setRole(normalizeRole(profile?.role));
        }
      } catch {
        if (isMounted) {
          setRole((currentRole) => currentRole ?? resolveRole(currentUser) ?? normalizeRole());
        }
      }
    };

    const bootstrap = async () => {
      try {
        const initialSession = await withTimeout(getInitialSession(), AUTH_BOOTSTRAP_TIMEOUT_MS);
        const currentUser = initialSession?.user ?? null;

        if (isMounted) {
          setSession(initialSession);
          setUser(currentUser);
          setRole(resolveRole(currentUser));
          setLoading(false);
        }

        void syncProfile(currentUser);
      } catch (error) {
        if (!isLockStealAbortError(error) && !isAuthBootstrapTimeoutError(error)) {
          console.error('Failed to initialize auth session.', error);
        }

        if (isMounted) {
          setRole(normalizeRole());
          setLoading(false);
        }
      }
    };

    void bootstrap();

    const { data: subscription } = supabase.auth.onAuthStateChange(async (_, nextSession) => {
      if (!isMounted) {
        return;
      }

      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setRole(resolveRole(nextSession?.user ?? null));
      void syncProfile(nextSession?.user ?? null);
    });

    return () => {
      isMounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const contextValue = useMemo(
    () => ({
      session,
      user,
      role,
      loading,
      hasSupabaseConfig,
      signIn: signInUseCase,
      signUp: signUpUseCase,
      signOut: signOutUseCase
    }),
    [session, user, role, loading]
  );

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
}
