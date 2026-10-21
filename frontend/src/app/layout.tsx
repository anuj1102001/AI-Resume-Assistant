import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

// Shortlist's voice is direct and encouraging: a characterful grotesque for headings, a clean sans for everything else.
const display = Bricolage_Grotesque({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-display", display: "swap" });
const sans = Geist({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-sans", display: "swap" });
const mono = Geist_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Shortlist · A stronger resume, with evidence", template: "%s · Shortlist" },
  description: "Understand your strengths, uncover skill gaps and tailor your resume to the roles you want, with AI that explains its recommendations and quotes your resume as evidence.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F6F7FB" },
    { media: "(prefers-color-scheme: dark)", color: "#0C0D16" },
  ],
};

// Applies the theme chosen in Settings before first paint, so there's no flash of the wrong theme.
const THEME_SCRIPT = `try{var t=localStorage.getItem("shortlist.theme");if(t==="light"||t==="dark")document.documentElement.classList.add(t)}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
