import { Brand } from './PublicLayout';
export function AuthLayout({ children }) {
  return (
    <div className="public-site relative min-h-screen overflow-hidden bg-slate-100 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto">
        <Brand />
      </div>
      <div className="relative mx-auto flex min-h-[80vh] w-full max-w-4xl items-center justify-center">
        {children}
      </div>
    </div>
  );
}
