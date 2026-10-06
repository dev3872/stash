import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { useAuth0 } from '@auth0/auth0-react';
import { useApi } from '../api/useApi.js';
import { Avatar } from './Avatar.jsx';
import { Icon } from './Icon.jsx';
import { useStats } from '../lib/stats.jsx';

function useUnreadCount() {
  const { request, isAuthenticated } = useApi();
  const location = useLocation();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isAuthenticated) {
      setCount(0);
      return undefined;
    }
    let stopped = false;
    const tick = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const data = await request('/conversations/unread');
        if (!stopped) setCount(data.count);
      } catch {
        // badge is best-effort
      }
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [isAuthenticated, request, location.pathname]);

  return count;
}

function StreakPill() {
  const { stats } = useStats();
  if (!stats) return null;
  const label = `${stats.streak}-day streak${stats.activeToday ? '' : ', read a bite today to keep it'}`;
  return (
    <Link to="/profile" className={`streak-pill${stats.activeToday ? ' lit' : ''}`} aria-label={label} title={label}>
      <Icon name="flame" size={18} filled={stats.activeToday} />
      <span aria-hidden="true">{stats.streak}</span>
    </Link>
  );
}

export function Layout() {
  const { user, isAuthenticated, isLoading, error: authError } = useAuth0();
  const { login } = useApi();
  const unread = useUnreadCount();
  const { pathname } = useLocation();
  // The lesson player is a full-screen experience with its own controls.
  const immersive = /^\/(learn|sequences)\//.test(pathname);

  if (immersive) {
    return (
      <div className="app app-immersive">
        <main id="main" className="main-immersive" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    );
  }

  return (
    <div className="app">
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="topbar">
        <div className="topbar-inner">
          <Link to="/" className="brand" aria-label="Stash home">
            <span className="brand-mark" aria-hidden="true">
              <svg viewBox="0 0 32 32" width="30" height="30">
                <rect width="32" height="32" rx="10" fill="currentColor" />
                <rect x="8" y="8" width="16" height="4" rx="2" fill="#fff" />
                <rect x="8" y="14" width="16" height="4" rx="2" fill="#fff" opacity=".7" />
                <rect x="8" y="20" width="10" height="4" rx="2" fill="#ffc23d" />
              </svg>
            </span>
            <span>Stash</span>
          </Link>

          <nav className="tabbar" aria-label="Main">
            <NavLink to="/" end className="tab">
              <Icon name="home" />
              <span className="tab-label">Home</span>
            </NavLink>
            <NavLink to="/explore" className="tab">
              <Icon name="compass" />
              <span className="tab-label">Explore</span>
            </NavLink>
            <NavLink to="/create" className="tab tab-create">
              <span className="tab-create-btn"><Icon name="plus" /></span>
              <span className="tab-label">Create</span>
            </NavLink>
            <NavLink to="/messages" className="tab">
              <span className="tab-icon">
                <Icon name="message" />
                {unread > 0 ? <span className="badge">{unread > 9 ? '9+' : unread}</span> : null}
              </span>
              <span className="tab-label">Messages{unread > 0 ? <span className="visually-hidden">, {unread} unread</span> : null}</span>
            </NavLink>
            <NavLink to="/profile" className="tab">
              {isAuthenticated ? <Avatar user={user} size={24} /> : <Icon name="user" />}
              <span className="tab-label">Profile</span>
            </NavLink>
          </nav>

          <div className="topbar-end">
            <StreakPill />
            {!isLoading && !isAuthenticated ? (
              <button type="button" className="btn btn-primary btn-small signin" onClick={() => login()}>Sign in</button>
            ) : null}
          </div>
        </div>
      </header>

      <main id="main" className="main" tabIndex={-1}>
        {authError ? (
          <div className="auth-error" role="alert">
            <strong>Sign-in didn’t work.</strong> {authError.error_description || authError.message}
          </div>
        ) : null}
        <Outlet />
      </main>
    </div>
  );
}
