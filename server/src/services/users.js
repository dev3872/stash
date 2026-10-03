import { User } from '../models/index.js';

const USERINFO_TIMEOUT_MS = 5000;

async function fetchUserInfo(userinfoUrl, token) {
  if (!userinfoUrl || !token) return {};
  try {
    const res = await fetch(userinfoUrl, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(USERINFO_TIMEOUT_MS),
    });
    if (!res.ok) return {};
    return await res.json();
  } catch {
    return {};
  }
}

/** Reads profile fields from standard or namespaced custom claims on the access token. */
function profileFromClaims(payload) {
  const pick = (field) => {
    if (typeof payload[field] === 'string') return payload[field];
    const key = Object.keys(payload).find((k) => k.startsWith('http') && k.endsWith(`/${field}`));
    return key && typeof payload[key] === 'string' ? payload[key] : undefined;
  };
  return { name: pick('name'), email: pick('email'), picture: pick('picture'), nickname: pick('nickname') };
}

function cleanProfile(info) {
  const email = typeof info.email === 'string' ? info.email : undefined;
  const name = info.name && info.name !== email ? info.name : info.nickname || info.name;
  return {
    ...(name ? { name: String(name).slice(0, 120) } : {}),
    ...(email ? { email } : {}),
    ...(info.picture ? { picture: String(info.picture) } : {}),
  };
}

/**
 * Upserts the local user for an Auth0 subject. Profile data is fetched from
 * Auth0's /userinfo only when the user is new or still missing a name, so most
 * requests cost a single indexed lookup.
 */
export async function upsertUserFromToken(payload, token, userinfoUrl) {
  const sub = payload.sub;
  const existing = await User.findOne({ auth0Sub: sub });
  // Auth0 rate-limits /userinfo, so a user without a name is retried at most hourly.
  if (existing && (existing.name || Date.now() - existing.updatedAt.getTime() < 60 * 60 * 1000)) {
    return existing;
  }

  const claims = profileFromClaims(payload);
  const info = claims.name || claims.email ? claims : { ...claims, ...(await fetchUserInfo(userinfoUrl, token)) };
  const profile = cleanProfile(info);

  try {
    return await User.findOneAndUpdate(
      { auth0Sub: sub },
      { $set: profile, $setOnInsert: { auth0Sub: sub } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  } catch (err) {
    // Two first requests raced on the unique index; the other one won.
    if (err?.code === 11000) return User.findOne({ auth0Sub: sub });
    throw err;
  }
}

export function publicUser(user) {
  if (!user) return { id: null, name: 'Deleted learner', picture: null };
  return {
    id: String(user._id),
    name: user.name || 'Learner',
    picture: user.picture || null,
  };
}
