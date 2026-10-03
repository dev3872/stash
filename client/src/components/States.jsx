import { Link } from 'react-router';

export function Spinner({ label = 'Loading…', inline = false }) {
  return (
    <div className={inline ? 'spinner-inline' : 'state'} role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <span className={inline ? 'visually-hidden' : 'state-text'}>{label}</span>
    </div>
  );
}

export function CardSkeleton({ count = 2 }) {
  return (
    <div aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div className="card skeleton" key={i}>
          <div className="sk sk-row" />
          <div className="sk sk-title" />
          <div className="sk sk-line" />
          <div className="sk sk-line" />
          <div className="sk sk-line short" />
        </div>
      ))}
    </div>
  );
}

export function ErrorState({ error, onRetry, title = 'That didn’t load' }) {
  return (
    <div className="state state-error" role="alert">
      <p className="state-title">{title}</p>
      <p className="state-text">{error?.message || 'Something went wrong.'}</p>
      {onRetry ? <button type="button" className="btn" onClick={onRetry}>Try again</button> : null}
    </div>
  );
}

export function EmptyState({ title, children, action }) {
  return (
    <div className="state state-empty">
      <p className="state-title">{title}</p>
      {children ? <p className="state-text">{children}</p> : null}
      {action ? (
        <Link className="btn btn-primary" to={action.to}>{action.label}</Link>
      ) : null}
    </div>
  );
}

export function SignInPrompt({ title, children, onSignIn }) {
  return (
    <div className="state state-empty">
      <p className="state-title">{title}</p>
      {children ? <p className="state-text">{children}</p> : null}
      <button type="button" className="btn btn-primary" onClick={onSignIn}>Sign in</button>
    </div>
  );
}
