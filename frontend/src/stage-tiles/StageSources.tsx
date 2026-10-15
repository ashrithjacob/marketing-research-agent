import { sourceHost, sourceKindWords, type Source } from '../api';

export default function StageSources({ sources }: { sources: Source[] }) {
  if (sources.length === 0) return <p className="muted small">This run kept no sources.</p>;
  return (
    <table className="stage-table">
      <thead>
        <tr>
          <th>Page</th>
          <th>Site</th>
          <th>Kind</th>
        </tr>
      </thead>
      <tbody>
        {sources.map((source) => (
          <tr key={source.id} className={source.admitted === false ? 'muted' : ''}>
            <td>
              <a href={source.url} target="_blank" rel="noreferrer">
                {source.title || source.url}
              </a>
            </td>
            <td>{sourceHost(source.url)}</td>
            <td>
              {sourceKindWords(source.kind)}
              {source.admitted === false && ' · not used'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
