import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { QueryClient } from "@tanstack/react-query";

type User = {
  id: number;
  email: string;
  name: string;
  authProvider: string;
};

type AuthContextValue = {
  user: User | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function parseError(response: Response) {
  try {
    const data = await response.json();
    return data?.error || "Something went wrong";
  } catch {
    return "Something went wrong";
  }
}

async function postJson(path: string, body?: unknown) {
  const response = await fetch(path, {
    method: "POST",
    cache: "no-store",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return response.json();
}

export function AuthProvider({ children, queryClient }: { children: React.ReactNode; queryClient: QueryClient }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    fetch("/api/auth/me", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : { user: null }))
      .then((data) => {
        if (mounted) setUser(data.user ?? null);
      })
      .catch(() => {
        if (mounted) setUser(null);
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      async signIn(email, password) {
        const data = await postJson("/api/auth/login", { email, password });
        queryClient.clear();
        setUser(data.user);
      },
      async signUp(name, email, password) {
        const data = await postJson("/api/auth/signup", { name, email, password });
        queryClient.clear();
        setUser(data.user);
      },
      async signOut() {
        await postJson("/api/auth/logout");
        queryClient.clear();
        setUser(null);
      },
    }),
    [queryClient, user, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
