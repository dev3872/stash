import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
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
  if (mode === 'pdf') {
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
  const topics = useResource((signal) => request('/topics', { signal }), []);
  const [topic, setTopic] = useState('');
  const [mode, setMode] = useState('pdf');
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
          Upload a PDF or paste a link, and Stash turns it into a short series of posts that explain the topic.
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
    if (mode === 'pdf') {
      body = new FormData();
      body.append('topic', topic.trim());
      body.append('file', file);
    } else {
      body = { topic: topic.trim(), url: url.trim() };
    }

    setPending(true);
    try {
      const result = await request('/sources', { method: 'POST', auth: true, body });
      navigate(`/sequences/${result.source.id}`, { state: { justCreated: true } });
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
      <header className="page-head">
        <h1>Create a lesson</h1>
        <p className="muted">Give Stash a PDF or a web page. It pulls out the main ideas and writes 4–8 short posts that explain them in plain language.</p>
      </header>

      <form className="form card" onSubmit={submit} noValidate aria-busy={pending}>
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
            <div className="segmented">
              <label className={mode === 'pdf' ? 'active' : ''}>
                <input type="radio" name="mode" value="pdf" checked={mode === 'pdf'} onChange={() => setMode('pdf')} />
                <Icon name="file" size={18} /> Upload a PDF
              </label>
              <label className={mode === 'url' ? 'active' : ''}>
                <input type="radio" name="mode" value="url" checked={mode === 'url'} onChange={() => setMode('url')} />
                <Icon name="link" size={18} /> Paste a link
              </label>
            </div>
          </fieldset>

          {mode === 'pdf' ? (
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
            <span className="spinner" aria-hidden="true" />
            <div>
              <strong>{mode === 'pdf' ? 'Reading your PDF and writing posts…' : 'Reading the page and writing posts…'}</strong>
              <span className="muted small">This usually takes a few seconds and can take up to a minute. {elapsed > 0 ? `${elapsed}s` : ''}</span>
            </div>
          </div>
        ) : null}

        <button type="submit" className="btn btn-primary btn-block" disabled={pending}>
          {pending ? 'Creating lesson…' : 'Create lesson'}
        </button>
      </form>
    </div>
  );
}
