import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'MC Manager - Minecraft Server Management',
  description: 'Production-grade Minecraft server management platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-900 text-white">
        {children}
      </body>
    </html>
  );
}
