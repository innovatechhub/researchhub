import { formatDate } from '../../../core/utils/date';

export function NotificationList({ notifications, onMarkRead, updatingId }) {
  if (notifications.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-500">
        No notifications yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {notifications.map((notification) => (
        <article
          className={`rounded-xl border p-4 ${
            notification.is_read
              ? 'border-slate-200 bg-white'
              : 'border-brand-200 bg-brand-50/60'
          }`}
          key={notification.id}
        >
          <p className="text-sm text-slate-800">{notification.message}</p>
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="text-xs text-slate-500">{formatDate(notification.created_at)}</span>
            {!notification.is_read ? (
              <button
                type="button"
                className="rounded-lg border border-brand-300 bg-white px-2 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-100"
                disabled={updatingId === notification.id}
                onClick={() => onMarkRead(notification.id)}
              >
                {updatingId === notification.id ? 'Updating...' : 'Mark as read'}
              </button>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}
