import { Header } from '@/components/layout/header';
import { AssemblyProvider } from '@/contexts/AssemblyContext';

export default function AssemblyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AssemblyProvider>
      <div className="flex min-h-screen w-full flex-col">
        <Header />
        <main className="flex flex-1 flex-col gap-4 bg-muted/40 p-4 md:gap-8 md:p-10">
          {children}
        </main>
      </div>
    </AssemblyProvider>
  );
}
