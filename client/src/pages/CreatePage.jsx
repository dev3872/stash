import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useApi } from '../api/useApi.js';
import { useResource } from '../lib/useResource.js';
import { Icon } from '../components/Icon.jsx';
import { SignInPrompt, Spinner } from '../components/States.jsx';

const MAX_BYTES = 15 * 1024 * 1024;

function validate({ topic, mode, file, url }) {
  const errors = {};
  const name = topic.trim();
  if (name.length < 2) errors.topic = 'Enter a topic, like “String theory”.';
  else if (name.length > 80) errors.topic = 'Keep the topic under 80 characters.';
  if (mode === 'topic') {
    // Nothing else to check: the server looks up the article.
  } else if (mode === 'pdf') {
    if (!file) errors.file = 'Choose a PDF to upload.';
    else if (file.type !== 'application/pdf') errors.file = 'That file isn’t a PDF. Choose a .pdf file.';
    else if (file.size > MAX_BYTES) errors.file = `That PDF is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 15 MB.`;
    else if (file.size === 0) errors.file = 'That file is empty.';
  } else {
    const value = url.trim();
    if (!value) errors.url = 'Paste a link to an article or page.';
    else {
      try {
        const parsed = new URL(value);
        if (!['http:', 'https:'].includes(parsed.protocol)) errors.url = 'Use a link that starts with http:// or https://.';
      } catch {
        errors.url = 'That doesn’t look like a full link. It should start with https://';
      }
    }
  }
  return errors;
}

export function CreatePage() {
  const { request, isAuthenticated, authLoading, login } = useApi();
  const navigate = useNavigate();
  const location = useLocation();
  const topics = useResource((signal) => request('/topics', { signal }), []);
  const [topic, setTopic] = useState(() => (typeof location.state?.topic === 'string' ? location.state.topic : ''));
  const [mode, setMode] = useState('topic');
  const [file, setFile] = useState(null);
  const [url, setUrl] = useState('');
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [pending, setPending] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const errorRef = useRef(null);

  useEffect(() => {
    if (!pending) return undefined;
    setElapsed(0);
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [pending]);

  useEffect(() => {
    if (serverError) errorRef.current?.focus();
  }, [serverError]);

  if (authLoading) return <Spinner />;
  if (!isAuthenticated) {
    return (
      <div className="page">
        <SignInPrompt title="Sign in to create a lesson" onSignIn={() => login('/create')}>
          Type a topic, upload a PDF or paste a link, and Stash turns it into a short, swipeable lesson with pictures.
        </SignInPrompt>
      </div>
    );
  }

  async function submit(e) {
    e.preventDefault();
    const found = validate({ topic, mode, file, url });
    setErrors(found);
    setServerError('');
    if (Object.keys(found).length) {
      document.getElementById(`create-${Object.keys(found)[0]}`)?.focus();
      return;
    }

    let body;
    if (mode === 'topic') {
      body = { topic: topic.trim(), from: 'wikipedia' };
    } else if (mode === 'pdf') {
      body = new FormData();
      body.append('topic', topic.trim());
      body.append('file', file);
    } else {
      body = { topic: topic.trim(), url: url.trim() };
    }

    setPending(true);
    try {
      const result = await request('/sources', { method: 'POST', auth: true, body });
      navigate(`/learn/${result.source.id}?b=1`, { state: { justCreated: true } });
    } catch (err) {
      setServerError(err.message);
      setPending(false);
    }
  }

  const fieldProps = (key) => ({
    'aria-invalid': errors[key] ? true : undefined,
    'aria-describedby': `create-${key}-hint${errors[key] ? ` create-${key}-error` : ''}`,
  });

  return (
    <div className="page">
      <header className="create-hero">
        <span className="create-hero-icon" aria-hidden="true"><Icon name="bolt" size={30} filled /></span>
        <div>
          <h1>Make a lesson</h1>
          <p>Type a topic, or give Stash a PDF or a web page. It pulls out the main ideas and makes 4–8 bite-sized cards with pictures.</p>
        </div>
      </header>
      <ol className="create-steps" aria-label="How it works">
        <li><span>1</span> Name a topic</li>
        <li><span>2</span> Pick a source</li>
        <li><span>3</span> Read your bites</li>
      </ol>

      <form className="form create-form" onSubmit={submit} noValidate aria-busy={pending}>
        <fieldset disabled={pending} className="form-fields">
          <div className="field">
            <label htmlFor="create-topic" className="label">Topic</label>
            <input
              id="create-topic"
              className={`input${errors.topic ? ' input-invalid' : ''}`}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              list="topic-options"
              placeholder="String theory"
              maxLength={120}
              autoComplete="off"
              {...fieldProps('topic')}
            />
            <datalist id="topic-options">
              {topics.data?.topics.map((t) => <option key={t.id} value={t.name} />)}
            </datalist>
            <p id="create-topic-hint" className="hint">Use an existing topic or name a new one.</p>
            {errors.topic ? <p id="create-topic-error" className="form-error">{errors.topic}</p> : null}
          </div>

          <fieldset className="field">
            <legend className="label">Source</legend>
            <div className="source-tiles">
              <label className={`source-tile${mode === 'topic' ? ' active' : ''}`}>
                <input type="radio" name="mode" value="topic" checked={mode === 'topic'} onChange={() => setMode('topic')} />
                <span className="source-tile-icon tile-topic" aria-hidden="true"><Icon name="globe" size={24} /></span>
                <span className="source-tile-name">Just the topic</span>
                <span className="source-tile-hint">We find the article for you</span>
              </label>
              <label className={`source-tile${mode === 'pdf' ? ' active' : ''}`}>
                <input type="radio" name="mode" value="pdf" checked={mode === 'pdf'} onChange={() => setMode('pdf')} />
                <span className="source-tile-icon tile-pdf" aria-hidden="true"><Icon name="file" size={24} /></span>
                <span className="source-tile-name">Upload a PDF</span>
                <span className="source-tile-hint">Papers, notes, chapters</span>
              </label>
              <label className={`source-tile${mode === 'url' ? ' active' : ''}`}>
                <input type="radio" name="mode" value="url" checked={mode === 'url'} onChange={() => setMode('url')} />
                <span className="source-tile-icon tile-link" aria-hidden="true"><Icon name="link" size={24} /></span>
                <span className="source-tile-name">Paste a link</span>
                <span className="source-tile-hint">Articles and explainers</span>
              </label>
            </div>
          </fieldset>

          {mode === 'topic' ? (
            <p className="topic-mode-note" id="create-topic-mode">
              <Icon name="globe" size={18} />
              <span>Stash finds the Wikipedia article for this topic, turns it into bite-sized cards, and adds pictures and short videos from Wikimedia Commons where they fit.</span>
            </p>
          ) : mode === 'pdf' ? (
            <div className="field">
              <label htmlFor="create-file" className="label">PDF file</label>
              <input
                id="create-file"
                type="file"
                accept="application/pdf"
                className={`input input-file${errors.file ? ' input-invalid' : ''}`}
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                {...fieldProps('file')}
              />
              <p id="create-file-hint" className="hint">
                {file ? `${file.name} · ${(file.size / 1024 / 1024).toFixed(1)} MB` : 'Up to 15 MB. The PDF needs selectable text; scanned images won’t work.'}
              </p>
              {errors.file ? <p id="create-file-error" className="form-error">{errors.file}</p> : null}
            </div>
          ) : (
            <div className="field">
              <label htmlFor="create-url" className="label">Link</label>
              <input
                id="create-url"
                type="url"
                inputMode="url"
                className={`input${errors.url ? ' input-invalid' : ''}`}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/article"
                {...fieldProps('url')}
              />
              <p id="create-url-hint" className="hint">Articles and explainer pages work best. Pages behind a login can’t be read.</p>
              {errors.url ? <p id="create-url-error" className="form-error">{errors.url}</p> : null}
            </div>
          )}
        </fieldset>

        {serverError ? (
          <div className="alert" role="alert" tabIndex={-1} ref={errorRef}>
            <strong>We couldn’t make a lesson from that.</strong>
            <span>{serverError}</span>
          </div>
        ) : null}

        {pending ? (
          <div className="pending" role="status" aria-live="polite">
            <ol className="pending-steps" aria-hidden="true">
              {[
                mode === 'topic' ? 'Finding a Wikipedia article' : mode === 'pdf' ? 'Reading your PDF' : 'Reading the page',
                'Picking the key ideas',
                'Adding pictures and videos',
              ].map((label, i) => {
                const stage = elapsed < 3 ? 0 : elapsed < 8 ? 1 : 2;
                return (
                  <li key={label} className={i < stage ? 'done' : i === stage ? 'now' : ''}>
                    <span className="pending-dot">{i < stage ? <Icon name="check" size={14} /> : null}</span>
                    {label}
                  </li>
                );
              })}
            </ol>
            <span className="visually-hidden">{mode === 'topic' ? 'Finding an article and writing bites.' : mode === 'pdf' ? 'Reading your PDF and writing bites.' : 'Reading the page and writing bites.'}</span>
            <span className="muted small">This usually takes a few seconds and can take up to a minute. {elapsed > 0 ? `${elapsed}s` : ''}</span>
          </div>
        ) : null}

        <button type="submit" className="btn btn-primary btn-block" disabled={pending}>
          {pending ? 'Making your lesson…' : 'Make my lesson'}
        </button>
      </form>
    </div>
  );
}
