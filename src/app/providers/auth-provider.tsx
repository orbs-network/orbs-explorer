"use client";
import React from "react";
import { Button } from "@/components/ui/button";
import { GoogleOAuthProvider, useGoogleLogin } from "@react-oauth/google";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { useCallback } from "react";
import { useMobile } from "../../lib/hooks/use-mobile";
import { Skeleton } from "@/components/skeleton";

export const protectedApi = axios.create();
const GOOGLE_TOKEN_KEY = "google_token";

protectedApi.interceptors.request.use((cfg) => {
  const accessToken = localStorage.getItem(GOOGLE_TOKEN_KEY);
  if (accessToken) cfg.headers.Authorization = `Bearer ${accessToken}`;
  return cfg;
});

export type User = {
  authorized: boolean;
  email: string;
  emailVerified: boolean;
  avatar: string;
  lastName: string;
  firstName: string;
  id: string;
};

export const parseUser = (data: any): User => {
  return {
    authorized: data.hd === "orbs.com",
    email: data.email,
    emailVerified: data.email_verified,
    avatar: data.picture,
    lastName: data.family_name,
    firstName: data.given_name,
    id: data.email,
  };
};

const scope = ["openid", "email", "profile"].join(" ");
export const fetchGoogleUser = async (): Promise<User> => {
  const { data } = await protectedApi.get(
    "https://www.googleapis.com/oauth2/v3/userinfo"
  );

  return parseUser(data);
};

export const useUserQuery = () => {
  return useQuery({
    queryKey: ["user"],
    queryFn: async () => {
      try {
        const user = await fetchGoogleUser();
        return user;
      } catch (error) {
        console.log("error", error);
        return null;
      }
    },
    staleTime: Infinity,
  });
};

export const useUser = () => {
  const isMobile = useMobile();
  const { refetch, data: user, isLoading } = useUserQuery();
  // const loginDesktopWithPrompt = useGoogleLogin({
  //   scope,
  //   prompt: "select_account",
  //   onSuccess: async ({ access_token }) => {
  //     localStorage.setItem(GOOGLE_TOKEN_KEY, access_token);
  //     refetch();
  //   },
  // });

  const loginMobile = useCallback(() => {
    if (typeof window === "undefined") return;
    const tokenClient = (window as any).google.accounts.oauth2.initCodeClient({
      client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
      scope,
      ux_mode: "redirect",
      redirect_uri: `${process.env.NEXT_PUBLIC_PRODUCTION_URL}/auth/callback`, // Must be whitelisted in Google Console
      prompt: "select_account",
      callback: () => {}, // won't be called in redirect mode
    });

    // Trigger login manually
    tokenClient.requestCode();
  }, []);

  const loginSilently = useGoogleLogin({
    onSuccess: (tokenResponse) => {
      localStorage.setItem(GOOGLE_TOKEN_KEY, tokenResponse.access_token);
      refetch();
    },
    flow: "implicit",
    scope: "openid email profile",
    // 👇 This is the magic that prevents the popup
    prompt: "",
  });

  return {
    user,
    loginSilently,
    login: isMobile ? loginMobile : loginSilently,
    isLoading,
  };
};

export function AuthWrapper({ children }: { children: React.ReactNode }) {
  const { user, login, isLoading: isUserLoading } = useUser();

  if (isUserLoading) {
    return (
      <div>
        <Skeleton style={{ width: "70%" }} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="w-full h-full flex items-center justify-center p-[50px]">
        <div className="flex flex-col gap-4">
          <p>Please login to continue</p>
          <Button onClick={() => login()}>Login</Button>
        </div>
      </div>
    );
  }

  return children;
}

export const AuthComponent = ({ children }: { children: React.ReactNode }) => {
  const { user } = useUser();

  if (!user) return null;

  return children;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  return (
    <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!}>
      {children}
    </GoogleOAuthProvider>
  );
};
