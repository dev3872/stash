import { Icon } from './Icon.jsx';

export function SourceLine({ source }) {
  if (!source) return null;
  if (source.kind === 'url') {
    let host = source.url;
    try {
      host = new URL(source.url).hostname.replace(/^www\./, '');
    } catch {
      // keep raw
    }
    return (
      <a className="source-line" href={source.url} target="_blank" rel="noopener noreferrer nofollow">
        <Icon name="link" size={16} />
        <span>{source.title ? `${source.title} · ${host}` : host}</span>
      </a>
    );
  }
  return (
    <span className="source-line">
      <Icon name="file" size={16} />
      <span>Uploaded PDF{source.originalName ? ` · ${source.originalName}` : ''}</span>
    </span>
  );
}
