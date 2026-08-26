import { Outlet } from 'react-router-dom';
import { ThemeProvider } from 'next-themes';
import Header from '@/components/Header';
import { Toaster } from '@/components/ui/sonner';

export const Layout = () => {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <div className="min-h-screen bg-background text-foreground">
        <Header />
        <main className="pb-20 md:pb-0">
          <Outlet />
        </main>
        <Toaster position="top-center" richColors closeButton />
      </div>
    </ThemeProvider>
  );
};
