import "./globals.css";

export const metadata = {
  title: "Philippine Plants — Searchable Flora Database",
  description:
    "Searchable database of the vascular plants of the Philippines, with taxonomy, distribution, conservation status, and photos. Data from Co's Digital Flora of the Philippines.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
