import "./globals.css";
import PwaRegister from "./components/pwa-register";
import LoginPopup from "./components/LoginPopup";

export const metadata = {
  title: "Global Nexus Capital",
  description: "Global Nexus Capital platform",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      {
        url: "/icons/icon-192x192.jpeg",
        sizes: "192x192",
        type: "image/jpeg",
      },
      {
        url: "/icons/icon-512x512.jpeg",
        sizes: "512x512",
        type: "image/jpeg",
      },
    ],
    apple: [
      {
        url: "/icons/icon-192x192.jpeg",
        sizes: "192x192",
        type: "image/jpeg",
      },
    ],
  },
  appleWebApp: {
    capable: true,
    title: "Global Nexus Capital",
    statusBarStyle: "default",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <PwaRegister />
        <LoginPopup />
        {children}
      </body>
    </html>
  );
}
