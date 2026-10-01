import type { Metadata } from "next";
import BackgroundRotator from "../components/BackgroundRotator";
import "./globals.css";

export const metadata:Metadata={title:{default:"Owed — Get paid what’s owed",template:"%s · Owed"},description:"Automated invoice follow-up for trades and service businesses."};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en" className="dark"><body className="min-h-screen bg-canvas text-ink antialiased"><BackgroundRotator/>{children}</body></html>}
