// app/providers.tsx
"use client";

import { PrivyProvider } from "@privy-io/react-auth";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID || ""}
      config={{
        loginMethods: ["google", "apple"],
        appearance: {
          theme: "light",
          accentColor: "#000000",
          logo: "/logo.png",
          showWalletLoginFirst: false,
        },
        // [수정된 부분] createOnLogin을 ethereum 내부로 이동
        embeddedWallets: {
          ethereum: {
            createOnLogin: "users-without-wallets",
          },
          solana: {
            createOnLogin: "users-without-wallets",
          },
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
