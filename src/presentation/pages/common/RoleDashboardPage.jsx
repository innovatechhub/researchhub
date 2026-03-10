export function RoleDashboardPage({ title, description }) {
  return (
    <section className="rounded-2xl bg-white p-6 shadow-card">
      <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
      <p className="mt-3 text-sm text-slate-600">{description}</p>
    </section>
  );
}
