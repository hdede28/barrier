import type { Metadata } from "next";
import { Inter, Manrope } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { LowStakesBanner } from "@/components/LowStakesBanner";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const manrope = Manrope({ variable: "--font-manrope", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Velyo",
  description: "Belgeler, akışında. Kişisel, yerel-öncelikli PDF çalışma alanı.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body className={`${inter.variable} ${manrope.variable} antialiased`}>
        <LowStakesBanner />
        <Nav />
        <main className="panel-enter mx-auto max-w-5xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
