import { Link } from 'react-router';
import { Icon } from './Icon.jsx';

const WEEKDAY = new Intl.DateTimeFormat(undefined, { weekday: 'narrow', timeZone: 'UTC' });
const WEEKDAY_LONG = new Intl.DateTimeFormat(undefined, { weekday: 'long', timeZone: 'UTC' });

function dayDate(day) {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function GoalRing({ value, goal, size = 92 }) {
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(1, goal ? value / goal : 0);
  return (
    <span className="goal-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} className="goal-ring-track" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          className="goal-ring-fill"
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className="goal-ring-label">
        <strong>{Math.min(value, 99)}</strong>
        <span>/{goal}</span>
      </span>
    </span>
  );
}

export function WeekStrip({ week }) {
  return (
    <ol className="week-strip" aria-label="Reading this week">
      {week.map((d) => {
        const date = dayDate(d.day);
        const active = d.bites > 0;
        return (
          <li key={d.day} className={`${active ? 'on' : ''}${d.isToday ? ' today' : ''}`}>
            <span className="week-dot" aria-hidden="true">{active ? <Icon name="check" size={14} /> : null}</span>
            <span className="week-day" aria-hidden="true">{WEEKDAY.format(date)}</span>
            <span className="visually-hidden">
              {d.isToday ? 'Today' : WEEKDAY_LONG.format(date)}: {d.bites} {d.bites === 1 ? 'bite' : 'bites'}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** The home "today" card: daily goal ring, streak and the week at a glance. */
export function DailyGoal({ stats, resume }) {
  const left = Math.max(0, stats.dailyGoal - stats.todayBites);
  let message;
  if (stats.goalMet) message = 'Daily goal done. Anything more is a bonus.';
  else if (stats.todayBites > 0) message = `${left} more ${left === 1 ? 'bite' : 'bites'} to hit today’s goal.`;
  else if (stats.streak > 0) message = `Read a bite today to keep your ${stats.streak}-day streak.`;
  else message = `Read ${stats.dailyGoal} bites a day to build a streak.`;

  return (
    <section className={`today-card${stats.goalMet ? ' met' : ''}`} aria-labelledby="today-title">
      <div className="today-top">
        <GoalRing value={stats.todayBites} goal={stats.dailyGoal} />
        <div className="today-text">
          <h2 id="today-title">Today’s goal</h2>
          <p>{message}</p>
          <p className={`streak-line${stats.activeToday ? ' lit' : ''}`}>
            <Icon name="flame" size={18} filled={stats.activeToday} />
            <strong>{stats.streak}</strong> day streak
          </p>
        </div>
      </div>
      <WeekStrip week={stats.week} />
      {resume ? (
        <Link to={resume.href} className="btn btn-sun btn-block">
          <Icon name="play" size={16} filled /> {resume.label}
        </Link>
      ) : (
        <Link to="/explore" className="btn btn-sun btn-block">
          <Icon name="compass" size={18} /> Find a lesson
        </Link>
      )}
    </section>
  );
}

export function GuestHero({ onSignIn }) {
  return (
    <section className="today-card guest" aria-labelledby="guest-title">
      <div className="today-top">
        <span className="guest-art" aria-hidden="true">
          <Icon name="bolt" size={40} filled />
        </span>
        <div className="today-text">
          <h2 id="guest-title">Learn anything in 5-minute bites</h2>
          <p>Type a topic, or give Stash a PDF or an article, and get a short, swipeable lesson with pictures. Sign in to keep a streak and pick up where you left off.</p>
        </div>
      </div>
      <div className="guest-actions">
        <button type="button" className="btn btn-sun" onClick={onSignIn}>Sign in to start a streak</button>
        <Link to="/explore" className="btn">Browse topics</Link>
      </div>
    </section>
  );
}
