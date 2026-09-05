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
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    if (!hasSupabaseConfig || !supabase) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    let profileRequest = 0;
    let authEvents = 0;

    const syncProfile = async (currentUser) => {
      const request = ++profileRequest;
      if (!currentUser) {
        if (isMounted) {
          setRole(null);
          setProfile(null);
          setProfileLoading(false);
        }
        return;
      }

      setProfileLoading(true);
      try {
        const fetchedProfile = await getUserProfileUseCase(currentUser.id);
        if (isMounted && request === profileRequest) {
          setRole(normalizeRole(fetchedProfile?.role));
          setProfile(fetchedProfile ?? null);
        }
      } catch {
        if (isMounted && request === profileRequest) {
          setRole(null);
          setProfile(null);
        }
      } finally {
        if (isMounted && request === profileRequest) setProfileLoading(false);
      }
    };

    const bootstrap = async () => {
      const initialEvent = authEvents;
      try {
        const initialSession = await withTimeout(getInitialSession(), AUTH_BOOTSTRAP_TIMEOUT_MS);
        if (!isMounted || authEvents !== initialEvent) return;
        const currentUser = initialSession?.user ?? null;

        if (isMounted) {
          setSession(initialSession);
          setUser(currentUser);
          setRole(null);
          setProfile(null);
        }

        await syncProfile(currentUser);
        if (isMounted) setLoading(false);
      } catch (error) {
        if (!isLockStealAbortError(error) && !isAuthBootstrapTimeoutError(error)) {
          console.error('Failed to initialize auth session.', error);
        }

        if (isMounted) {
          setRole(null);
          setLoading(false);
        }
      }
    };

    void bootstrap();

    const { data: subscription } = supabase.auth.onAuthStateChange(async (_, nextSession) => {
      if (!isMounted) {
        return;
      }

      const eventId = ++authEvents;
      ++profileRequest;
      setLoading(false);
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setRole(null);
      setProfile(null);
      setProfileLoading(Boolean(nextSession?.user));
      // Supabase auth callbacks must return before making another client request.
      setTimeout(() => {
        if (isMounted && authEvents === eventId) void syncProfile(nextSession?.user ?? null);
      }, 0);
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
      profile,
      loading,
      profileLoading,
      hasSupabaseConfig,
      signIn: signInUseCase,
      signUp: signUpUseCase,
      signOut: signOutUseCase
    }),
    [session, user, role, profile, loading, profileLoading]
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
