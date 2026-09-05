import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { FiMenu, FiX, FiUser, FiMapPin, FiMail } from 'react-icons/fi';
import { site } from '../../core/config/site';
import { useAuth } from '../../app/providers/AuthProvider';
import { getDashboardRouteByRole } from '../../core/constants/routes';

const links = [
  ['/', 'Home'],
  ['/about', 'About'],
  ['/browse', 'Browse Research'],
  ['/guidelines', 'Guidelines'],
  ['/contact', 'Contact']
];
export function Brand({ compact = false }) {
  return (
    <Link to="/" className="brand-lockup" aria-label="ResearchHub BNHS home">
      <img src={site.logo} width="76" height="76" alt="" />
      <span>
        <strong>
          ResearchHub <em>BNHS</em>
        </strong>
        {!compact && <small>Digital Repository for Research Outputs</small>}
      </span>
    </Link>
  );
}
export function PublicLayout() {
  const { user, role, loading, profileLoading } = useAuth();
  const [open, setOpen] = useState(false);
  const menuButton = useRef(null);
  const { pathname } = useLocation();
  useEffect(() => {
    setOpen(false);
    window.scrollTo(0, 0);
  }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const close = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
        menuButton.current?.focus();
      }
    };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [open]);
  return (
    <div className="public-site">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <header className="public-header">
        <div className="site-container header-inner">
          <Brand />
          <button
            ref={menuButton}
            className="mobile-nav-toggle"
            aria-expanded={open}
            aria-controls="public-navigation"
            aria-label={open ? 'Close navigation' : 'Open navigation'}
            onClick={() => setOpen(!open)}
          >
            {open ? <FiX /> : <FiMenu />}
          </button>
          <nav
            id="public-navigation"
            className={`public-nav ${open ? 'is-open' : ''}`}
            aria-label="Main navigation"
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setOpen(false);
                menuButton.current?.focus();
              }
            }}
          >
            {links.map(([to, label]) => (
              <NavLink key={to} to={to} end={to === '/'}>
                {label}
              </NavLink>
            ))}
            <Link
              className="button button-navy nav-login"
              to={
                !loading && !profileLoading && user && role
                  ? getDashboardRouteByRole(role)
                  : '/login'
              }
            >
              <FiUser />
              {!loading && !profileLoading && user && role ? 'My Dashboard' : 'Login'}
            </Link>
          </nav>
        </div>
      </header>
      <main id="main-content">
        <Outlet />
      </main>
      <footer className="public-footer">
        <div className="site-container footer-inner">
          <div className="footer-brand">
            <img src={site.logo} width="62" height="62" alt="ResearchHub BNHS logo" />
            <div>
              <strong>{site.school}</strong>
              <p>ResearchHub BNHS: Digital Repository for Research Outputs</p>
            </div>
          </div>
          <p>
            <FiMapPin /> {site.location}
          </p>
          {site.email ? (
            <a href={`mailto:${site.email}`}>
              <FiMail />
              {site.email}
            </a>
          ) : (
            <Link to="/contact">
              <FiMail /> Contact the school
            </Link>
          )}
          <small>
            © {new Date().getFullYear()} {site.school}.<br />
            All rights reserved.
          </small>
        </div>
      </footer>
    </div>
  );
}
