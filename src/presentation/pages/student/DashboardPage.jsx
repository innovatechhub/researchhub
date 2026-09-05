import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../../app/providers/AuthProvider';
import { useToast } from '../../../app/providers/ToastProvider';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { NotificationList } from '../../components/notifications/NotificationList';
import { ResearchList } from '../../components/research/ResearchList';
import { listNotificationsUseCase, markNotificationAsReadUseCase } from '../../../application/usecases/notificationUseCases';
import {
  getResearchFileDownloadUrlUseCase,
  listStudentResearchesUseCase
} from '../../../application/usecases/researchUseCases';

export function DashboardPage() {
  const { user, session, hasSupabaseConfig } = useAuth();
  const toast = useToast();

  const [researches, setResearches] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fileLoadingId, setFileLoadingId] = useState('');
  const [notificationLoadingId, setNotificationLoadingId] = useState('');

  const loadData = useCallback(
    async () => {
      if (!hasSupabaseConfig || !user) {
        setLoading(false);
        return;
      }

      try {
        const [loadedResearches, loadedNotifications] = await Promise.all([
          listStudentResearchesUseCase(user.id),
          listNotificationsUseCase({
            accessToken: session?.access_token,
            userId: user.id
          })
        ]);

        setResearches(loadedResearches);
        setNotifications(loadedNotifications);
      } catch (error) {
        toast.error(error.message || 'Unable to load student dashboard.');
      } finally {
        setLoading(false);
      }
    },
    [hasSupabaseConfig, session?.access_token, toast, user]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenFile = async (research) => {
    try {
      setFileLoadingId(research.id);

      if (research.filePath) {
        const signedUrl = await getResearchFileDownloadUrlUseCase(research.filePath);
        window.open(signedUrl, '_blank', 'noopener,noreferrer');
        return;
      }

      if (research.fileUrl) {
        window.open(research.fileUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (error) {
      toast.error(error.message || 'Unable to open file.');
    } finally {
      setFileLoadingId('');
    }
  };

  const handleMarkRead = async (notificationId) => {
    try {
      setNotificationLoadingId(notificationId);
      await markNotificationAsReadUseCase({
        accessToken: session?.access_token,
        notificationId
      });

      setNotifications((current) =>
        current.map((entry) =>
          entry.id === notificationId ? { ...entry, is_read: true } : entry
        )
      );
    } catch (error) {
      toast.error(error.message || 'Unable to update notification.');
    } finally {
      setNotificationLoadingId('');
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl bg-white p-6 shadow-card">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-gradient-to-r from-brand-900 to-brand-700 p-6 text-white shadow-card">
        <p className="text-sm uppercase tracking-wide text-brand-100">Student Dashboard</p>
        <h2 className="mt-2 text-2xl font-bold">Track your research submissions</h2>
        <p className="mt-2 text-sm text-brand-100">
          View submission status, reviewer comments, and review notifications in one place.
        </p>
      </section>

      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-slate-900">My Research</h3>
          <ResearchList
            researches={researches}
            onOpenFile={handleOpenFile}
            fileLoadingId={fileLoadingId}
          />
        </div>

        <aside className="space-y-3">
          <h3 className="text-lg font-semibold text-slate-900">Notifications</h3>
          <NotificationList
            notifications={notifications}
            onMarkRead={handleMarkRead}
            updatingId={notificationLoadingId}
          />
        </aside>
      </section>
    </div>
  );
}
