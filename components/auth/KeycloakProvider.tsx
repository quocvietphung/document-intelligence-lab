"use client";

import type Keycloak from "keycloak-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

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
  error?: string;
};

const AuthContext = createContext<AuthState | null>(null);
type Session = Pick<
  AuthState,
  | "ready"
  | "authenticated"
  | "displayName"
  | "roles"
  | "tenantId"
  | "token"
  | "error"
>;
const signedOut: Session = {
  ready: false,
  authenticated: false,
  displayName: "Sign in",
  roles: [],
  tenantId: "Not signed in",
};
// Shared initialization survives React StrictMode's setup/cleanup cycle.
let initialization: Promise<Keycloak> | undefined;
function initialize() {
  initialization ??= import("keycloak-js").then(async ({ default: Client }) => {
    const client = new Client({
      url: process.env.NEXT_PUBLIC_KEYCLOAK_URL!,
      realm: process.env.NEXT_PUBLIC_KEYCLOAK_REALM || "credit-intelligence",
      clientId:
        process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID || "credit-intelligence-web",
    });
    await client.init({
      onLoad: "check-sso",
      pkceMethod: "S256",
      silentCheckSsoRedirectUri: `${window.location.origin}/silent-check-sso.html`,
      silentCheckSsoFallback: false,
      checkLoginIframe: false,
      messageReceiveTimeout: 30_000,
    });
    return client;
  });
  return initialization;
}
function snapshot(client: Keycloak): Session {
  if (!client.authenticated) return { ...signedOut, ready: true };
  return {
    ready: true,
    authenticated: true,
    displayName:
      client.tokenParsed?.name ||
      client.tokenParsed?.preferred_username ||
      "Signed in",
    roles: client.realmAccess?.roles || [],
    tenantId: client.tokenParsed?.tenant_id || "Missing tenant",
    token: client.token,
  };
}

export function KeycloakProvider({ children }: { children: React.ReactNode }) {
  const configured = process.env.NEXT_PUBLIC_DEMO_MODE !== "true" && Boolean(process.env.NEXT_PUBLIC_KEYCLOAK_URL);
  const [session, setSession] = useState<Session>(
    configured
      ? signedOut
      : {
          ready: true,
          authenticated: true,
          displayName: "Demo visitor",
          roles: [],
          tenantId: "praxisbank-demo",
        },
  );

  useEffect(() => {
    if (!configured) return;
    let active = true;
    let timer: number | undefined;
    void initialize()
      .then((client) => {
        if (!active) return;
        const sync = () => {
          if (active) setSession(snapshot(client));
        };
        client.onAuthLogout = sync;
        client.onAuthRefreshSuccess = sync;
        client.onAuthRefreshError = () => {
          client.clearToken();
          sync();
        };
        sync();
        timer = window.setInterval(() => {
          if (client.authenticated)
            void client
              .updateToken(60)
              .then(sync)
              .catch(() => {
                client.clearToken();
                sync();
              });
        }, 30_000);
      })
      .catch(() => {
        if (active)
          setSession({
            ...signedOut,
            ready: true,
            error: "Sign-in service unavailable. Reload to retry.",
          });
      });
    return () => {
      active = false;
      if (timer) window.clearInterval(timer);
    };
  }, [configured]);

  const login = useCallback(() => {
    if (!configured) return;
    void initialize()
      .then((client) =>
        client.login({
          redirectUri: `${window.location.origin}${window.location.pathname}`,
        }),
      )
      .catch(() =>
        setSession({
          ...signedOut,
          ready: true,
          error: "Unable to open sign-in. Reload to retry.",
        }),
      );
  }, [configured]);
  const logout = useCallback(() => {
    void initialize()
      .then((client) => client.logout({ redirectUri: window.location.origin }))
      .catch(() =>
        setSession((current) => ({
          ...current,
          error: "Sign-out failed. Please retry.",
        })),
      );
  }, []);
  return (
    <AuthContext.Provider
      value={{
        ...session,
        login,
        logout,
        mode: configured ? "keycloak" : "demo",
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside KeycloakProvider");
  return value;
}
