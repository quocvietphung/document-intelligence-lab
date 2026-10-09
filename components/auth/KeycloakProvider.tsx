"use client";

import type Keycloak from "keycloak-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type AuthState = {
  ready: boolean;
  authenticated: boolean;
  displayName: string;
  roles: string[];
  tenantId: string;
  login: () => void;
  logout: () => void;
  token?: string;
  mode: "demo" | "keycloak";
};

const AuthContext = createContext<AuthState | null>(null);

export function KeycloakProvider({ children }: { children: React.ReactNode }) {
  const configured = Boolean(process.env.NEXT_PUBLIC_KEYCLOAK_URL);
  const [keycloak, setKeycloak] = useState<Keycloak | null>(null);
  const [ready, setReady] = useState(!configured);
  const [authenticated, setAuthenticated] = useState(!configured);

  useEffect(() => {
    if (!configured || keycloak) return;
    let active = true;
    void import("keycloak-js").then(async ({ default: KeycloakClient }) => {
      if (!active) return;
      const client = new KeycloakClient({
        url: process.env.NEXT_PUBLIC_KEYCLOAK_URL!,
        realm: process.env.NEXT_PUBLIC_KEYCLOAK_REALM || "credit-intelligence",
        clientId: process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID || "credit-intelligence-web",
      });
      setKeycloak(client);
      try {
        const result = await client.init({
          onLoad: "check-sso",
          pkceMethod: "S256",
          silentCheckSsoRedirectUri: `${window.location.origin}/silent-check-sso.html`,
          checkLoginIframe: false,
        });
        if (!active) return;
        setAuthenticated(result);
      } finally {
        if (active) setReady(true);
      }
    });
    return () => { active = false; };
  }, [configured, keycloak]);

  useEffect(() => {
    if (!keycloak?.authenticated) return;
    const timer = window.setInterval(() => void keycloak.updateToken(45), 30_000);
    return () => window.clearInterval(timer);
  }, [keycloak, authenticated]);

  const login = useCallback(() => {
    if (keycloak) void keycloak.login({ redirectUri: window.location.href });
  }, [keycloak]);
  const logout = useCallback(() => {
    if (keycloak) void keycloak.logout({ redirectUri: window.location.origin });
  }, [keycloak]);

  const token = keycloak?.tokenParsed as Record<string, unknown> | undefined;
  const value = useMemo<AuthState>(() => ({
    ready,
    authenticated,
    displayName: (token?.name as string) || "Mara Klein",
    roles: keycloak?.realmAccess?.roles || ["ADVISOR", "REVIEWER"],
    tenantId: (token?.tenant_id as string) || "praxisbank-demo",
    login,
    logout,
    token: keycloak?.token,
    mode: configured ? "keycloak" : "demo",
  }), [authenticated, configured, keycloak?.realmAccess?.roles, keycloak?.token, login, logout, ready, token]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside KeycloakProvider");
  return value;
}
