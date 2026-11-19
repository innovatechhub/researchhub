import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  FiBarChart2,
  FiBell,
  FiBookOpen,
  FiCalendar,
  FiChevronDown,
  FiFileText,
  FiFolder,
  FiHelpCircle,
  FiHome,
  FiMenu,
  FiSettings,
  FiUser,
  FiUsers
} from 'react-icons/fi';
import { ROUTES } from '../../core/constants/routes';
import { useAuth } from '../../app/providers/AuthProvider';
import { useToast } from '../../app/providers/ToastProvider';
import {
  listNotificationsUseCase,
  markNotificationAsReadUseCase
} from '../../application/usecases/notificationUseCases';
import { formatDate } from '../../core/utils/date';
import { site } from '../../core/config/site';

const PORTAL_SUBTITLES = {
  'Teacher Portal': 'Review and Provide Corrections',
  'Student Portal': 'Research Submission and Feedback',
  'Admin Portal': 'Manage the Research Repository',
  'Researcher Portal': 'Browse Approved Research'
};

// Icon chosen from the label so the same nav arrays work for every role.
const ICONS = [
  [/review|approval/, FiFileText],
  [/manage|deadline/, FiFolder],
  [/student|assign/, FiUsers],
  [/report|progress/, FiBarChart2],
  [/setting/, FiSettings],
  [/help/, FiHelpCircle],
  [/notification/, FiBell],
  [/profile/, FiUser],
  [/my research|library|research|publication|preview|categor|strand/, FiBookOpen],
  [/user/, FiUsers],
  [/calendar/, FiCalendar]
];
function NavIcon({ label, className = 'h-5 w-5' }) {
  const Icon = ICONS.find(([pattern]) => pattern.test(label.toLowerCase()))?.[1] || FiHome;
  return <Icon aria-hidden="true" className={className} />;
}

function flattenNavItems(items) {
  return items.flatMap((item) => {
    if (!item.children?.length) return [item];
    return [...(item.to ? [{ to: item.to, label: item.label }] : []), ...item.children];
  });
}

function SchoolIllustration() {
  return (
    <svg aria-hidden="true" viewBox="0 0 180 110" className="mx-auto h-24 w-40 text-sky-200/80">
      <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
        <path d="M10 100h160M20 100V58h140v42M30 100V66m24 34V66m24 34V66m24 34V66m24 34V66" />
        <path d="M70 58V40l20-14 20 14v18M90 26V12m0 0 14 4-14 4" />
        <path d="M82 100V80h16v20M85 50h10M20 58l-6-6h152l-6 6" />
      </g>
    </svg>
  );
}

export function PortalLayout({ portalLabel, navItems = [] }) {
  const { user, session, role, profile, hasSupabaseConfig, signOut } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [expandedMenus, setExpandedMenus] = useState({});
  const [notifications, setNotifications] = useState([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [notificationPanelOpen, setNotificationPanelOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notificationLoadingId, setNotificationLoadingId] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const notificationPanelRef = useRef(null);
  const userMenuRef = useRef(null);

  const mobileItems = useMemo(() => flattenNavItems(navItems), [navItems]);
  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.is_read).length,
    [notifications]
  );
  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'Account';
  const roleLabel = role ? role.charAt(0).toUpperCase() + role.slice(1) : '';

  const loadNotifications = useCallback(async () => {
    if (!hasSupabaseConfig || !user?.id || !session?.access_token) {
      setNotifications([]);
      return;
    }
    setLoadingNotifications(true);
    try {
      setNotifications(
        await listNotificationsUseCase({ accessToken: session.access_token, userId: user.id })
      );
    } catch (error) {
      toast.error(error.message || 'Unable to load notifications.');
    } finally {
      setLoadingNotifications(false);
    }
  }, [hasSupabaseConfig, session?.access_token, toast, user?.id]);

  const handleMarkNotificationRead = useCallback(
    async (notificationId) => {
      if (!hasSupabaseConfig || !session?.access_token) return;
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
        if (!item.children?.length) return;
        if (
          item.children.some((child) => child.to === location.pathname) ||
          item.to === location.pathname
        )
          next[item.label] = true;
      });
      return next;
    });
  }, [location.pathname, navItems]);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    if (!hasSupabaseConfig || !user?.id || !session?.access_token) return undefined;
    const intervalId = window.setInterval(() => void loadNotifications(), 30000);
    return () => window.clearInterval(intervalId);
  }, [hasSupabaseConfig, loadNotifications, session?.access_token, user?.id]);

  useEffect(() => {
    setNotificationPanelOpen(false);
    setUserMenuOpen(false);
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!notificationPanelRef.current?.contains(event.target)) setNotificationPanelOpen(false);
      if (!userMenuRef.current?.contains(event.target)) setUserMenuOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    navigate(ROUTES.login, { replace: true });
  };

  const navLinkClass = ({ isActive }) =>
    [
      'flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-[15px] font-medium transition',
      isActive
        ? 'bg-blue-600 text-white shadow-lg shadow-black/25'
        : 'text-blue-100 hover:bg-white/10 hover:text-white'
    ].join(' ');
  const badge = (item) =>
    /notification/i.test(item.label) && unreadCount > 0 ? (
      <span className="ml-auto inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] font-semibold text-white">
        {unreadCount > 99 ? '99+' : unreadCount}
      </span>
    ) : null;

  return (
    <div
      className={`portal-shell ${['Teacher Portal', 'Student Portal'].includes(portalLabel) ? 'portal-academic' : ''} min-h-screen md:grid md:h-screen md:grid-cols-[250px_minmax(0,1fr)] md:overflow-hidden`}
    >
      <aside className="hidden bg-navy-800 text-white md:sticky md:top-0 md:flex md:h-screen md:flex-col md:overflow-hidden">
        <NavLink
          to="/"
          className="block px-5 pb-5 pt-6 text-center"
          aria-label="ResearchHub BNHS home"
        >
          <img
            src={site.logo}
            className="mx-auto h-[72px] w-[72px] rounded-full border-2 border-white/30 object-cover"
            alt=""
          />
          <span className="mt-2 block text-lg font-bold leading-tight">
            ResearchHub
            <br />
            BNHS
          </span>
        </NavLink>
        <div className="mx-5 border-t border-white/15" />

        <nav className="flex-1 space-y-1.5 overflow-y-auto px-3.5 py-5" aria-label={portalLabel}>
          {navItems.map((item) => {
            if (!item.children?.length) {
              return (
                <NavLink className={navLinkClass} key={item.to} to={item.to}>
                  <NavIcon label={item.label} />
                  <span>{item.label}</span>
                  {badge(item)}
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
                  aria-expanded={isExpanded}
                  className={[
                    'flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-[15px] font-medium transition',
                    isActiveGroup
                      ? 'bg-blue-600 text-white shadow-lg shadow-black/25'
                      : 'text-blue-100 hover:bg-white/10 hover:text-white'
                  ].join(' ')}
                  onClick={() => {
                    const nextExpanded = !isExpanded;
                    setExpandedMenus((current) => ({ ...current, [item.label]: nextExpanded }));
                    if (item.to && nextExpanded) navigate(item.to);
                  }}
                >
                  <NavIcon label={item.label} />
                  <span className="flex-1">{item.label}</span>
                  <FiChevronDown
                    aria-hidden="true"
                    className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  />
                </button>
                {isExpanded ? (
                  <div className="ml-9 space-y-1 border-l border-white/20 pl-3">
                    {item.children.map((child) => (
                      <NavLink
                        className={({ isActive }) =>
                          `block rounded-lg px-2 py-1.5 text-sm transition ${
                            isActive
                              ? 'bg-white/15 text-white'
                              : 'text-blue-200 hover:bg-white/10 hover:text-white'
                          }`
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
        </nav>

        <div className="px-4 pb-6 pt-3 text-center">
          <SchoolIllustration />
          <p className="mt-2 text-sm italic leading-snug text-blue-100">
            Research Today,
            <br />
            Innovate Tomorrow
          </p>
        </div>
      </aside>

      {mobileMenuOpen ? (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            className="h-full w-[80%] max-w-[320px] overflow-y-auto bg-navy-800 text-white"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-white/15 px-4 py-4">
              <p className="text-base font-bold">ResearchHub BNHS</p>
              <p className="mt-1 text-xs uppercase tracking-wide text-blue-200">{portalLabel}</p>
            </div>
            <nav className="space-y-1 px-3 py-3" aria-label={portalLabel}>
              {mobileItems.map((item) => (
                <NavLink
                  className={navLinkClass}
                  key={item.to}
                  onClick={() => setMobileMenuOpen(false)}
                  to={item.to}
                >
                  <NavIcon label={item.label} className="h-4 w-4" />
                  {item.label}
                  {badge(item)}
                </NavLink>
              ))}
            </nav>
            <div className="border-t border-white/15 px-4 py-4">
              <p className="truncate text-xs text-blue-200">{user?.email}</p>
              <button
                type="button"
                className="mt-3 w-full rounded-lg border border-white/30 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/10"
                onClick={() => void handleSignOut()}
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="portal-main min-w-0 flex min-h-screen flex-col md:h-screen md:overflow-y-auto">
        <header className="sticky top-0 z-30 border-b border-[#d6e0f3] bg-white/95 backdrop-blur">
          <div className="flex min-h-[72px] w-full items-center justify-between gap-3 px-4 py-2 sm:px-8">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <button
                type="button"
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-50 md:hidden"
                aria-label="Open navigation menu"
                onClick={() => setMobileMenuOpen(true)}
              >
                <FiMenu className="h-5 w-5" />
              </button>
              <div className="min-w-0">
                <p className="portal-title text-2xl font-extrabold leading-tight text-navy-800">
                  ResearchHub BNHS
                </p>
                <p className="portal-subtitle text-sm italic text-blue-700">
                  {portalLabel}
                  {PORTAL_SUBTITLES[portalLabel] ? (
                    <span className="portal-description">
                      <span aria-hidden="true" className="mx-2 not-italic">
                        •
                      </span>
                      {PORTAL_SUBTITLES[portalLabel]}
                    </span>
                  ) : null}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2 sm:gap-4">
              <div className="relative" ref={notificationPanelRef}>
                <button
                  type="button"
                  className="relative inline-flex h-10 w-10 items-center justify-center text-navy-800 transition hover:text-blue-700"
                  aria-label={`Open notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
                  aria-expanded={notificationPanelOpen}
                  onClick={() => setNotificationPanelOpen((current) => !current)}
                >
                  <FiBell className="h-6 w-6" />
                  {unreadCount > 0 ? (
                    <span className="absolute right-0 top-0 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  ) : null}
                </button>
                {notificationPanelOpen ? (
                  <div className="absolute right-0 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] rounded-xl border border-[#d6e0f3] bg-white p-3 shadow-soft">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-sm font-semibold text-navy-800">Notifications</p>
                      <button
                        type="button"
                        className="text-xs font-medium text-slate-500 hover:text-slate-700"
                        onClick={() => void loadNotifications()}
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
                            className={`rounded-lg border p-3 ${
                              notification.is_read
                                ? 'border-slate-200 bg-white'
                                : 'border-blue-200 bg-blue-50'
                            }`}
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
                                  className="rounded-md border border-blue-300 bg-white px-2 py-1 text-[11px] font-semibold text-blue-800 transition hover:bg-blue-100"
                                  disabled={notificationLoadingId === notification.id}
                                  onClick={() => void handleMarkNotificationRead(notification.id)}
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

              <div className="relative" ref={userMenuRef}>
                <button
                  type="button"
                  className="flex items-center gap-3 rounded-full py-1 pl-1 pr-2 transition hover:bg-slate-100"
                  aria-haspopup="menu"
                  aria-expanded={userMenuOpen}
                  onClick={() => setUserMenuOpen((current) => !current)}
                >
                  <span className="grid h-11 w-11 place-items-center rounded-full bg-navy-100 text-navy-600">
                    <FiUser aria-hidden="true" className="h-6 w-6" />
                  </span>
                  <span className="hidden text-left leading-tight sm:block">
                    <span className="block text-sm font-bold text-navy-800">{displayName}</span>
                    <span className="block text-xs text-slate-500">{roleLabel}</span>
                  </span>
                  <FiChevronDown aria-hidden="true" className="h-4 w-4 text-navy-800" />
                </button>
                {userMenuOpen ? (
                  <div
                    role="menu"
                    className="absolute right-0 mt-2 w-60 rounded-xl border border-[#d6e0f3] bg-white p-2 shadow-soft"
                  >
                    <p className="truncate px-3 py-2 text-xs text-slate-500">{user?.email}</p>
                    <button
                      type="button"
                      role="menuitem"
                      className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-navy-800 transition hover:bg-navy-50"
                      onClick={() => void handleSignOut()}
                    >
                      Sign out
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </header>

        <main className="w-full flex-1 px-4 py-6 sm:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
