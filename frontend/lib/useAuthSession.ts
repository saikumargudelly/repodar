import { useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";

export interface AuthSession {
  isLoaded: boolean;
  isSignedIn: boolean;
  userId: string | null;
  token: string | null;
  isReady: boolean;
}

export function useAuthSession(): AuthSession {
  const { isLoaded, userId, isSignedIn, getToken } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!isLoaded) {
      setIsReady(false);
      return;
    }
    if (!isSignedIn || !userId) {
      setToken(null);
      setIsReady(false);
      return;
    }

    let active = true;
    getToken()
      .then((tok) => {
        if (active) {
          setToken(tok);
          setIsReady(!!tok);
        }
      })
      .catch(() => {
        if (active) {
          setToken(null);
          setIsReady(false);
        }
      });

    return () => {
      active = false;
    };
  }, [isLoaded, isSignedIn, userId, getToken]);

  return {
    isLoaded,
    isSignedIn: isSignedIn ?? false,
    userId: userId ?? null,
    token,
    isReady,
  };
}
