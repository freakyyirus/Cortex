"use client";

import { PrivyProvider as BasePrivyProvider } from "@privy-io/react-auth";

const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
const clientId = process.env.NEXT_PUBLIC_PRIVY_CLIENT_ID || undefined;

export default function PrivyProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // NEVER initialize the Privy provider with an invalid/undefined app ID at
  // build/prerender time — the lib throws and kills `next build`. Instead the
  // app shell still renders; wallet/SSO features just fail open at runtime
  // with a clear warning until NEXT_PUBLIC_PRIVY_APP_ID is configured.
  if (!appId) {
    if (typeof window !== "undefined") {
      console.warn(
        "[privy] NEXT_PUBLIC_PRIVY_APP_ID is not set — wallet/log-in features are disabled. Set it in Vercel → Project Settings → Environment Variables (see .env.example).",
      );
    }
    return <>{children}</>;
  }

  return (
    <BasePrivyProvider
      appId={appId}
      clientId={clientId}
      config={{
        embeddedWallets: {
          createOnLogin: "users-without-wallets",
          requireUserPasswordOnCreate: false,
        },
        loginMethods: ["wallet", "email"],
        appearance: {
          showWalletLoginFirst: false,
        },
      }}
    >
      {children}
    </BasePrivyProvider>
  );
}