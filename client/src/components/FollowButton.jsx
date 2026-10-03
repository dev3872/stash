import { useEffect, useState } from 'react';
import { useApi } from '../api/useApi.js';
import { useToast } from './Toast.jsx';

export function FollowButton({ userId, name, initial = false, onChange, small = false }) {
  const { request, isAuthenticated, login } = useApi();
  const toast = useToast();
  const [following, setFollowing] = useState(initial);
  const [busy, setBusy] = useState(false);

  useEffect(() => setFollowing(initial), [initial]);

  async function toggle() {
    if (!isAuthenticated) return login();
    setBusy(true);
    try {
      const result = await request(`/users/${userId}/follow`, { method: following ? 'DELETE' : 'POST', auth: true });
      setFollowing(result.following);
      onChange?.(result);
    } catch (err) {
      if (err.status !== 401) toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className={`btn ${following ? '' : 'btn-primary'}${small ? ' btn-small' : ''}`}
      onClick={toggle}
      disabled={busy}
      aria-pressed={following}
      aria-label={`${following ? 'Unfollow' : 'Follow'} ${name}`}
    >
      {following ? 'Following' : 'Follow'}
    </button>
  );
}
