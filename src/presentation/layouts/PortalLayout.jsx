import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { IoIosNotificationsOutline } from 'react-icons/io';
import { ROUTES } from '../../core/constants/routes';
import { useAuth } from '../../app/providers/AuthProvider';
import { useToast } from '../../app/providers/ToastProvider';
import {
  listNotificationsUseCase,
  markNotificationAsReadUseCase
} from '../../application/usecases/notificationUseCases';
import { formatDate } from '../../core/utils/date';

function MenuIcon({ className = '' }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path
        d="M4 7h16M4 12h16M4 17h16"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function ItemIcon({ type, className = '' }) {
  if (type === 'upload') {
    return (
      <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
        <path
          d="M12 16V6m0 0-3.5 3.5M12 6l3.5 3.5"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.8"
        />
        <rect height="7" rx="2" stroke="currentColor" strokeWidth="1.8" width="14" x="5" y="13" />
      </svg>
    );
  }

  if (type === 'review') {
    return (
      <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
        <rect height="14" rx="2" stroke="currentColor" strokeWidth="1.8" width="12" x="6" y="5" />
        <path
          d="M9 9h6M9 12h6M9 15h4"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.8"
        />
      </svg>
    );
  }

  if (type === 'users') {
    return (
      <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
        <circle cx="9" cy="9" r="3" stroke="currentColor" strokeWidth="1.8" />
        <path
          d="M4.5 18c0-2.5 2-4.5 4.5-4.5s4.5 2 4.5 4.5"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.8"
        />
        <path
          d="M15.5 15.5a4 4 0 0 1 4 2.5M14.5 6.8a2.6 2.6 0 0 1 0 4.4"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.8"
        />
      </svg>
    );
  }

  if (type === 'library') {
    return (
      <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
        <path
          d="M6 5h9a3 3 0 0 1 3 3v11H9a3 3 0 0 0-3 3V5Z"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <path
          d="M6 5v14a3 3 0 0 1 3-3h9"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.8"
        />
      </svg>
    );
  }

  if (type === 'settings') {
    return (
      <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="3.1" stroke="currentColor" strokeWidth="1.8" />
        <path
          d="M19 12a7.3 7.3 0 0 0-.08-1l2.06-1.6-2-3.4-2.45.8a7.7 7.7 0 0 0-1.74-1L14.5 3h-5L9.2 5.8a7.7 7.7 0 0 0-1.74 1L5 6l-2 3.4L5.06 11a7.3 7.3 0 0 0 0 2L3 14.6 5 18l2.46-.8c.53.42 1.12.76 1.74 1l.3 2.8h5l.29-2.8c.62-.24 1.2-.58 1.74-1L19 18l2-3.4L18.94 13c.04-.33.06-.66.06-1Z"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path
        d="M4 10.5 12 4l8 6.5V20H4v-9.5Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path d="M9 20v-5h6v5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

function mapIconType(item) {
  const value = `${item.label} ${item.to}`.toLowerCase();

  if (value.includes('submit')) {
    return 'upload';
  }

  if (value.includes('review') || value.includes('approval')) {
    return 'review';
  }

  if (value.includes('user')) {
    return 'users';
  }

  if (value.includes('library') || value.includes('research')) {
    return 'library';
  }

  if (value.includes('admin')) {
    return 'settings';
  }

  return 'dashboard';
}

function flattenNavItems(items) {
  return items.flatMap((item) => {
    if (!item.children?.length) {
      return [item];
    }

    const parentEntry = item.to ? [{ to: item.to, label: item.label }] : [];
    return [...parentEntry, ...item.children];
  });
}

export function PortalLayout({ portalLabel, navItems = [] }) {
  const { user, session, hasSupabaseConfig, signOut } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [expandedMenus, setExpandedMenus] = useState({});
  const [notifications, setNotifications] = useState([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [notificationPanelOpen, setNotificationPanelOpen] = useState(false);
  const [notificationLoadingId, setNotificationLoadingId] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const notificationPanelRef = useRef(null);

  const visibleItems = navItems;

  const mobileItems = useMemo(() => flattenNavItems(navItems), [navItems]);
  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.is_read).length,
    [notifications]
  );

  const loadNotifications = useCallback(async () => {
    if (!hasSupabaseConfig || !user?.id || !session?.access_token) {
      setNotifications([]);
      return;
    }

    setLoadingNotifications(true);
    try {
      const data = await listNotificationsUseCase({
        accessToken: session.access_token,
        userId: user.id
      });
      setNotifications(data);
    } catch (error) {
      toast.error(error.message || 'Unable to load notifications.');
    } finally {
      setLoadingNotifications(false);
    }
  }, [hasSupabaseConfig, session?.access_token, toast, user?.id]);

  const handleMarkNotificationRead = useCallback(
    async (notificationId) => {
      if (!hasSupabaseConfig || !session?.access_token) {
        return;
      }

      setNotificationLoadingId(notificationId);
      try {
        await markNotificationAsReadUseCase({
          accessToken: session.access_token,
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
    },
    [hasSupabaseConfig, session?.access_token, toast]
  );

  useEffect(() => {
    setExpandedMenus((current) => {
      const next = { ...current };

      navItems.forEach((item) => {
        if (!item.children?.length) {
          return;
        }

        const hasActiveChild = item.children.some((child) => child.to === location.pathname);
        const isActiveParent = item.to === location.pathname;
        if (hasActiveChild || isActiveParent) {
          next[item.label] = true;
        }
      });

      return next;
    });
  }, [location.pathname, navItems]);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    if (!hasSupabaseConfig || !user?.id || !session?.access_token) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      void loadNotifications();
    }, 30000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [hasSupabaseConfig, loadNotifications, session?.access_token, user?.id]);

  useEffect(() => {
    setNotificationPanelOpen(false);
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!notificationPanelRef.current?.contains(event.target)) {
        setNotificationPanelOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, []);

  const handleSignOut = async () => {
    await signOut();
    navigate(ROUTES.login, { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-100 md:grid md:h-screen md:grid-cols-[280px_1fr] md:overflow-hidden">
      <aside className="hidden bg-slate-900 text-white md:sticky md:top-0 md:flex md:h-screen md:flex-col md:overflow-hidden">
        <div className="border-b border-slate-800 px-5 py-5">
          <NavLink to="/" className="flex items-center gap-3">
            <img src="/brand/researchhub-bnhs-logo.jpg" className="h-11 w-11 rounded-full" alt="" />
            <span className="text-base font-semibold">ResearchHub BNHS</span>
          </NavLink>
          <p className="mt-1 text-xs uppercase tracking-wide text-slate-400">{portalLabel}</p>
        </div>

        <nav className="flex-1 space-y-2 px-4 py-4">
          {visibleItems.map((item) => {
            if (!item.children?.length) {
              return (
                <NavLink
                  className={({ isActive }) =>
                    [
                      'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                      isActive
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/40'
                        : 'text-slate-200 hover:bg-slate-800 hover:text-white'
                    ].join(' ')
                  }
                  key={item.to}
                  to={item.to}
                >
                  {({ isActive }) => (
                    <>
                      <span
                        className={[
                          'flex h-7 w-7 items-center justify-center rounded-lg transition',
                          isActive ? 'bg-white/15' : 'bg-slate-800 group-hover:bg-slate-700'
                        ].join(' ')}
                      >
                        <ItemIcon
                          className={['h-4 w-4', isActive ? 'text-white' : 'text-slate-300'].join(
                            ' '
                          )}
                          type={mapIconType(item)}
                        />
                      </span>
                      <span>{item.label}</span>
                    </>
                  )}
                </NavLink>
              );
            }

            const isExpanded = expandedMenus[item.label] ?? false;
            const isActiveGroup =
              item.to === location.pathname ||
              item.children.some((child) => child.to === location.pathname);

            return (
              <div className="space-y-1" key={item.label}>
                <button
                  type="button"
                  className={[
                    'group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition',
                    isActiveGroup
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/40'
                      : 'text-slate-200 hover:bg-slate-800 hover:text-white'
                  ].join(' ')}
                  onClick={() => {
                    const nextExpanded = !isExpanded;
                    setExpandedMenus((current) => ({
                      ...current,
                      [item.label]: nextExpanded
                    }));

                    if (item.to && nextExpanded) {
                      navigate(item.to);
                    }
                  }}
                >
                  <span
                    className={[
                      'flex h-7 w-7 items-center justify-center rounded-lg transition',
                      isActiveGroup ? 'bg-white/15' : 'bg-slate-800 group-hover:bg-slate-700'
                    ].join(' ')}
                  >
                    <ItemIcon
                      className={['h-4 w-4', isActiveGroup ? 'text-white' : 'text-slate-300'].join(
                        ' '
                      )}
                      type={mapIconType(item)}
                    />
                  </span>
                  <span className="flex-1">{item.label}</span>
                  <svg
                    className={[
                      'h-4 w-4 transition-transform',
                      isExpanded ? 'rotate-180' : 'rotate-0'
                    ].join(' ')}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="m6 9 6 6 6-6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                    />
                  </svg>
                </button>

                {isExpanded ? (
                  <div className="ml-10 space-y-1 border-l border-slate-700 pl-3">
                    {item.children.map((child) => (
                      <NavLink
                        className={({ isActive }) =>
                          [
                            'block rounded-lg px-2 py-1.5 text-sm transition',
                            isActive
                              ? 'bg-slate-800 text-white'
                              : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                          ].join(' ')
                        }
                        key={child.to}
                        to={child.to}
                      >
                        {child.label}
                      </NavLink>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
          {visibleItems.length === 0 ? (
            <p className="px-2 text-xs text-slate-400">No matching menu item.</p>
          ) : null}
        </nav>

        <div className="border-t border-slate-800 px-4 py-4">
          <p className="truncate text-xs text-slate-400">{user?.email}</p>
          <button
            type="button"
            className="mt-3 w-full rounded-lg border border-slate-600 px-3 py-2 text-sm font-medium text-slate-100 transition hover:bg-slate-800"
            onClick={handleSignOut}
          >
            Sign out
          </button>
        </div>
      </aside>

      {mobileMenuOpen ? (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            className="h-full w-[80%] max-w-[320px] overflow-y-auto bg-slate-900 text-white"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-slate-800 px-4 py-4">
              <p className="text-base font-semibold">Research Repository</p>
              <p className="mt-1 text-xs uppercase tracking-wide text-slate-400">{portalLabel}</p>
            </div>
            <nav className="space-y-1 px-3 py-3">
              {mobileItems.map((item) => (
                <NavLink
                  className={({ isActive }) =>
                    [
                      'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition',
                      isActive
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-200 hover:bg-slate-800 hover:text-white'
                    ].join(' ')
                  }
                  key={item.to}
                  onClick={() => setMobileMenuOpen(false)}
                  to={item.to}
                >
                  <ItemIcon className="h-4 w-4" type={mapIconType(item)} />
                  {item.label}
                </NavLink>
              ))}
            </nav>
            <div className="border-t border-slate-800 px-4 py-4">
              <p className="truncate text-xs text-slate-400">{user?.email}</p>
              <button
                type="button"
                className="mt-3 w-full rounded-lg border border-slate-600 px-3 py-2 text-sm font-medium text-slate-100 transition hover:bg-slate-800"
                onClick={() => {
                  void handleSignOut();
                }}
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex min-h-screen flex-col md:h-screen md:overflow-y-auto">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
            <div className="flex items-center gap-2 md:hidden">
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-50"
                aria-label="Open navigation menu"
                onClick={() => setMobileMenuOpen(true)}
              >
                <MenuIcon className="h-5 w-5" />
              </button>
              <p className="text-sm font-semibold text-slate-800">{portalLabel}</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <div className="relative" ref={notificationPanelRef}>
                <button
                  type="button"
                  className="relative inline-flex h-10 w-10 items-center justify-center text-slate-700 transition hover:text-slate-900"
                  aria-label="Open notifications"
                  onClick={() => setNotificationPanelOpen((current) => !current)}
                >
                  <IoIosNotificationsOutline className="h-6 w-6" />
                  {unreadCount > 0 ? (
                    <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  ) : null}
                </button>

                {notificationPanelOpen ? (
                  <div className="absolute right-0 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-900">Notifications</p>
                      <button
                        type="button"
                        className="text-xs font-medium text-slate-500 hover:text-slate-700"
                        onClick={() => {
                          void loadNotifications();
                        }}
                      >
                        Refresh
                      </button>
                    </div>

                    <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                      {loadingNotifications ? (
                        <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-500">
                          Loading notifications...
                        </p>
                      ) : notifications.length === 0 ? (
                        <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-500">
                          No notifications yet.
                        </p>
                      ) : (
                        notifications.slice(0, 8).map((notification) => (
                          <article
                            className={[
                              'rounded-lg border p-3',
                              notification.is_read
                                ? 'border-slate-200 bg-white'
                                : 'border-brand-200 bg-brand-50/50'
                            ].join(' ')}
                            key={notification.id}
                          >
                            <p className="text-sm text-slate-800">{notification.message}</p>
                            <div className="mt-2 flex items-center justify-between gap-2">
                              <span className="text-xs text-slate-500">
                                {formatDate(notification.created_at)}
                              </span>
                              {!notification.is_read ? (
                                <button
                                  type="button"
                                  className="rounded-md border border-brand-300 bg-white px-2 py-1 text-[11px] font-semibold text-brand-700 transition hover:bg-brand-100"
                                  disabled={notificationLoadingId === notification.id}
                                  onClick={() => {
                                    void handleMarkNotificationRead(notification.id);
                                  }}
                                >
                                  {notificationLoadingId === notification.id
                                    ? 'Updating...'
                                    : 'Mark read'}
                                </button>
                              ) : null}
                            </div>
                          </article>
                        ))
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {mobileItems.length > 0 ? (
            <nav className="mx-auto flex w-full max-w-6xl gap-2 overflow-x-auto border-t border-slate-200 px-4 py-2 sm:px-6 md:hidden">
              {mobileItems.map((item) => (
                <NavLink
                  className={({ isActive }) =>
                    [
                      'flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition',
                      isActive
                        ? 'bg-indigo-600 text-white'
                        : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                    ].join(' ')
                  }
                  key={item.to}
                  to={item.to}
                >
                  <ItemIcon className="h-3.5 w-3.5" type={mapIconType(item)} />
                  {item.label}
                </NavLink>
              ))}
            </nav>
          ) : null}
        </header>

        <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
