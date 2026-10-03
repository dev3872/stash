import { EmptyState } from '../components/States.jsx';

export function NotFoundPage() {
  return (
    <div className="page">
      <EmptyState title="This page doesn’t exist" action={{ to: '/', label: 'Go to the feed' }}>
        The link may be broken, or the post may have been removed.
      </EmptyState>
    </div>
  );
}
