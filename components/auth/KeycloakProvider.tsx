"use client";

import type Keycloak from "keycloak-js";
import {authCallback,authDeadline,keycloakInitOptions,restoredWorkspacePath,workspaceReturnPath} from '@/lib/auth-initialization';
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
function initialize(interactive=false) {
  initialization ??= authDeadline(import("keycloak-js").then(async ({ default: Client }) => {
    const configuration = {
      url: process.env.NEXT_PUBLIC_KEYCLOAK_URL!,
      realm: process.env.NEXT_PUBLIC_KEYCLOAK_REALM || "credit-intelligence",
      clientId:
        process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID || "credit-intelligence-web",
    };
    let client = new Client(configuration);
    try{await authDeadline(client.init(keycloakInitOptions(window.location.href,interactive)),interactive||authCallback(window.location.href)?15000:4000);}
    catch(error){
      if(interactive||authCallback(window.location.href))throw error;
      // Restrictive browsers may block silent SSO. An explicit sign-in remains available.
      client=new Client(configuration);await client.init(keycloakInitOptions(window.location.href,true));
    }
    if(client.authenticated){
      try{const target=restoredWorkspacePath(sessionStorage.getItem('lab-auth-return'),window.location.href);sessionStorage.removeItem('lab-auth-return');if(target){window.history.replaceState(null,'',target);window.dispatchEvent(new PopStateEvent('popstate'));}}catch{/* Storage may be unavailable; authentication still succeeds. */}
    }
    return client;
  })).catch(error=>{initialization=undefined;throw error;});
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
  const configured = Boolean(process.env.NEXT_PUBLIC_KEYCLOAK_URL);
  const [session, setSession] = useState<Session>(
    configured
      ? signedOut
      : {
          ready: true,
          authenticated: false,
          displayName: "Sign in",
          roles: [],
          tenantId: "Not signed in",
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
    try{sessionStorage.setItem('lab-auth-return',JSON.stringify({path:workspaceReturnPath(window.location.href),time:Date.now()}));}catch{/* No credentials are persisted. */}
    void initialize(true)
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
        mode: "keycloak",
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
