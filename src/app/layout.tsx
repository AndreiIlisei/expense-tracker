import * as React from 'react';

import '@/styles/globals.css';
import '@/styles/colors.css';

import AppSkeleton from '@/components/AppSkeleton';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html>
      <body>
        <AppSkeleton>{children}</AppSkeleton>
      </body>
    </html>
  );
}
