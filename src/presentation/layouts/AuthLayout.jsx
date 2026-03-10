export function AuthLayout({ children }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-100 px-4 py-10 sm:px-6 lg:px-8">
      <div className="absolute inset-x-0 top-0 h-64 bg-gradient-to-r from-brand-800 via-brand-700 to-brand-500" />
      <div className="relative mx-auto flex min-h-[80vh] w-full max-w-4xl items-center justify-center">
        {children}
      </div>
    </div>
  );
}
