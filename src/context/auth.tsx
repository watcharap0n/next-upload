import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/router";

type User = {
  username?: string;
  token?: string;
};

type AuthContextValue = {
  user: User | null;
  login: (username: string, token?: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
};

const STORAGE_KEY = "next-upload-auth";

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setUser(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [user]);

  function login(username: string, token?: string) {
    const u: User = { username, token };
    setUser(u);
  }

  function logout() {
    setUser(null);
    router.push("/login");
  }

  const value: AuthContextValue = {
    user,
    login,
    logout,
    isAuthenticated: !!user?.token || !!user?.username,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
