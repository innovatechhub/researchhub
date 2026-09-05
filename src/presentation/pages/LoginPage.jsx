import { useState } from 'react';
import { Navigate, Link, useSearchParams, useLocation } from 'react-router-dom';
import { getDashboardRouteByRole } from '../../core/constants/routes';
import { useAuth } from '../../app/providers/AuthProvider';
import { useToast } from '../../app/providers/ToastProvider';
import { TextField } from '../components/common/TextField';

export function LoginPage() {
  const { hasSupabaseConfig, user, role, signIn, loading: authLoading, profileLoading } = useAuth();
  const [params] = useSearchParams();
  const location = useLocation();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  if (authLoading || profileLoading) return <p role="status">Loading your account…</p>;
  if (user && role) {
    const researchId = params.get('research');
    const from = location.state?.from;
    const safeFrom =
      typeof from === 'string' &&
      new RegExp(`^/${role}/(?:dashboard|progress|submit|library|research/[a-f0-9-]{36})$`).test(
        from
      )
        ? from
        : null;
    const target =
      researchId && /^[a-f0-9-]{36}$/i.test(researchId)
        ? `/${role}/library?research=${researchId}`
        : safeFrom || getDashboardRouteByRole(role);
    return <Navigate to={target} replace />;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);

    try {
      await signIn({ email, password });
      toast.success('Login successful.');
    } catch (error) {
      console.error('Login failed.', error);
      const statusText = error?.status ? ` (status ${error.status})` : '';
      toast.error(`${error.message || 'Authentication failed.'}${statusText}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="w-full max-w-md rounded-2xl bg-white p-6 shadow-card sm:p-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900">Welcome back</h2>
        <p className="mt-2 text-sm text-slate-500">
          Sign in to ResearchHub BNHS with your school account.
        </p>
      </div>

      {!hasSupabaseConfig ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
          Sign-in is temporarily unavailable. Please contact the school administrator.
        </div>
      ) : (
        <>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <TextField
              id="email"
              type="email"
              label="Email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="student@school.edu"
              required
            />

            <TextField
              id="password"
              type="password"
              label="Password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Minimum 6 characters"
              required
            />

            <button
              type="submit"
              className="w-full rounded-xl bg-brand-700 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={loading}
            >
              {loading ? 'Please wait...' : 'Sign in'}
            </button>
          </form>
        </>
      )}
      <Link to="/" className="mt-5 block text-center text-sm text-green-800">
        ← Back to ResearchHub BNHS
      </Link>
    </section>
  );
}
