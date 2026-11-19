import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../../app/providers/AuthProvider';
import { useToast } from '../../../app/providers/ToastProvider';
import {
  listNotificationsUseCase,
  markNotificationAsReadUseCase
} from '../../../application/usecases/notificationUseCases';
import { NotificationList } from '../../components/notifications/NotificationList';

export function NotificationsPage() {
  const { user, session, hasSupabaseConfig } = useAuth();
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState('');

  const load = useCallback(async () => {
    if (!hasSupabaseConfig || !user?.id || !session?.access_token) return setLoading(false);
    try {
      setItems(
        await listNotificationsUseCase({ accessToken: session.access_token, userId: user.id })
      );
    } catch (e) {
      toast.error(e.message || 'Unable to load notifications.');
    } finally {
      setLoading(false);
    }
  }, [hasSupabaseConfig, session?.access_token, toast, user?.id]);
  useEffect(() => {
    load();
  }, [load]);

  async function markRead(id) {
    setUpdatingId(id);
    try {
      await markNotificationAsReadUseCase({
        accessToken: session.access_token,
        notificationId: id
      });
      setItems((list) => list.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    } catch (e) {
      toast.error(e.message || 'Unable to update notification.');
    } finally {
      setUpdatingId('');
    }
  }

  return (
    <div className="space-y-5">
      <h1 className="workspace-heading">Notifications</h1>
      {loading ? (
        <p role="status" className="empty-panel">
          Loading notifications…
        </p>
      ) : (
        <NotificationList notifications={items} onMarkRead={markRead} updatingId={updatingId} />
      )}
    </div>
  );
}

export function ProfilePage() {
  const { user, profile, role } = useAuth();
  const rows = [
    ['Name', profile?.full_name],
    ['Email', user?.email],
    ['Role', role],
    ['Strand / Track', profile?.track]
  ];
  return (
    <div className="space-y-5">
      <h1 className="workspace-heading">Profile</h1>
      <section className="workspace-panel">
        <dl className="grid gap-4 sm:grid-cols-2">
          {rows.map(([label, value]) => (
            <div key={label} className="rounded-xl bg-navy-50 p-3">
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {label}
              </dt>
              <dd className="mt-1 font-semibold capitalize text-navy-900">{value || '—'}</dd>
            </div>
          ))}
        </dl>
        <p className="notice mt-5">
          To change your name, strand or password, contact the school administrator.
        </p>
      </section>
    </div>
  );
}

const HELP = [
  [
    'How do I submit my research?',
    'Open Dashboard or My Research, start a submission once, then upload your PDF or DOCX manuscript. Your chapters are detected for you to confirm before they go to your teacher.'
  ],
  [
    'Do I have to retype my details for every submission?',
    'No. Your details are saved with your research. Send a revision from the same research. A new research form is pre-filled from your previous one.'
  ],
  [
    'Where do I see my teacher’s corrections?',
    'On the Dashboard, open a chapter. Each section shows its corrections, and earlier comments stay listed after you resubmit.'
  ],
  [
    'Who do I ask for account changes?',
    'Contact the school administrator for password, strand or teacher assignment changes.'
  ]
];
export function HelpPage() {
  return (
    <div className="space-y-5">
      <h1 className="workspace-heading">Help &amp; Support</h1>
      <section className="workspace-panel space-y-4">
        {HELP.map(([question, answer]) => (
          <details key={question} className="rounded-xl border border-[#d6e0f3] p-4">
            <summary className="cursor-pointer font-semibold text-navy-900">{question}</summary>
            <p className="mt-2 text-sm text-slate-700">{answer}</p>
          </details>
        ))}
      </section>
    </div>
  );
}
