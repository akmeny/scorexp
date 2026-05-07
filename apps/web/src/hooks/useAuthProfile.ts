import type { Session } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchAuthStatus, fetchUserProfile, updateUserProfile } from "../lib/api";
import { authConfigured, signInWithProvider, signOut, supabase } from "../lib/auth";
import type { AuthProvider, UserProfile } from "../types";

export interface AuthProfileState {
  configured: boolean;
  providers: AuthProvider[];
  loading: boolean;
  session: Session | null;
  profile: UserProfile | null;
  error: string | null;
  signIn: (provider: AuthProvider) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (patch: {
    nickname?: string;
    notificationsEnabled?: boolean;
    notificationPermission?: UserProfile["notificationPermission"];
  }) => Promise<UserProfile | null>;
  refreshProfile: () => Promise<void>;
}

export function useAuthProfile(): AuthProfileState {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [providers, setProviders] = useState<AuthProvider[]>([]);
  const [loading, setLoading] = useState(authConfigured);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async (activeSession: Session | null, signal?: AbortSignal) => {
    if (!authConfigured || !activeSession?.access_token) {
      setProfile(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const nextProfile = await fetchUserProfile(activeSession.access_token, signal);
      setProfile(nextProfile);
    } catch {
      setError("Profil bilgisi alinamadi.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authConfigured) {
      setProviders([]);
      return;
    }

    let disposed = false;
    const controller = new AbortController();

    void fetchAuthStatus(controller.signal)
      .then((status) => {
        if (disposed) return;
        setProviders(status.configured ? status.providers : []);
      })
      .catch(() => {
        if (disposed) return;
        setProviders(["google"]);
      });

    return () => {
      disposed = true;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let disposed = false;
    const controller = new AbortController();

    void supabase.auth.getSession().then(({ data }) => {
      if (disposed) return;
      setSession(data.session);
      void loadProfile(data.session, controller.signal);
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      void loadProfile(nextSession);
    });

    return () => {
      disposed = true;
      controller.abort();
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signIn = useCallback(async (provider: AuthProvider) => {
    setError(null);
    await signInWithProvider(provider);
  }, []);

  const handleSignOut = useCallback(async () => {
    setError(null);
    await signOut();
    setSession(null);
    setProfile(null);
  }, []);

  const updateProfile = useCallback(
    async (patch: {
      nickname?: string;
      notificationsEnabled?: boolean;
      notificationPermission?: UserProfile["notificationPermission"];
    }) => {
      if (!session?.access_token) return null;

      setError(null);
      const nextProfile = await updateUserProfile({
        accessToken: session.access_token,
        ...patch
      });
      setProfile(nextProfile);
      return nextProfile;
    },
    [session?.access_token]
  );

  const refreshProfile = useCallback(async () => {
    await loadProfile(session);
  }, [loadProfile, session]);

  return useMemo(
    () => ({
      configured: authConfigured,
      providers,
      loading,
      session,
      profile,
      error,
      signIn,
      signOut: handleSignOut,
      updateProfile,
      refreshProfile
    }),
    [error, handleSignOut, loading, profile, providers, refreshProfile, session, signIn, updateProfile]
  );
}
