import "./globals.css";
import React from "react";
import Footer from "@/components/Footer";
import ScrollIndicator from "@/components/ScrollIndicator";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="h-screen overflow-hidden bg-zinc-950 text-zinc-100 antialiased">
        <div className="mx-auto flex h-screen w-full max-w-6xl flex-col px-6">
          <ScrollIndicator targetId="scroll-root" />
          <div id="scroll-root" className="flex-1 overflow-y-auto py-5">
            {children}
          </div>
          <Footer />
        </div>
      </body>
    </html>
  );
}
