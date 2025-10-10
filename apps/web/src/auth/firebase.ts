import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { createContext } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

let app: FirebaseApp | null = null;
export function getApp(): FirebaseApp {
  if (!app) app = initializeApp(firebaseConfig as any);
  return app!;
}

export interface AuthContextValue {
  user: User | null | undefined;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function useProvideAuth(): AuthContextValue {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  useEffect(() => {
    const auth = getAuth(getApp());
    return onAuthStateChanged(auth, (u) => setUser(u));
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    async signInWithGoogle() {
      const auth = getAuth(getApp());
      const provider = new GoogleAuthProvider();
      try {
        await signInWithPopup(auth, provider);
      } catch (err: any) {
        const code = err?.code || err?.message || '';
        // Fallback when popup is blocked or not allowed on this browser
        if (String(code).includes('popup') || String(code).includes('operation-not-supported')) {
          await signInWithRedirect(auth, provider);
          return;
        }
        throw err;
      }
    },
    async signOut() {
      const auth = getAuth(getApp());
      await signOut(auth);
    },
  }), [user]);

  return value;
}
