import type { Metadata } from "next";
import "./globals.scss";

export const metadata: Metadata = {
  title: "Nesora",
  description: "Get a glimpse into the daily living of your favorite creators",
  icons: {
    icon: [
      { url: "/icons.png", href: "/icons.png" },
    ],
    shortcut: "/icons.png",
    apple: "/icons.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" >

      <body>
        {children}
      </body>

    </html>
  );
}
