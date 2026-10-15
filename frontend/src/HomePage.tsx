import BrandTile from './BrandTile';
import MemoryFolder from './MemoryFolder';
import MemoryList from './MemoryList';
import NewBrandTile from './NewBrandTile';
import { Link, navigate, paths } from './route';
import { useBrands } from './use-brands';
import { useWorkspace } from './use-workspace';

export default function HomePage({ onError }: { onError: (message: string) => void }) {
  const brands = useBrands(onError);
  const { board } = useWorkspace('');
  return (
    <div className="brands-page">
      <div className="brand-grid">
        <NewBrandTile onError={onError} />
        {brands?.map((brand) => (
          <BrandTile key={brand.key} brand={brand} onOpen={() => navigate(paths.brand(brand.key))} />
        ))}
      </div>
      {brands === null && <p className="muted small">Loading brands…</p>}
      <div className="brands-below">
        <MemoryFolder onError={onError} />
        {board && <MemoryList entries={board.memory} onError={onError} />}
        {board && board.drafts.length > 0 && (
          <section className="side-box">
            <h2>Drafts</h2>
            <ul className="folder-list">
              {board.drafts.map((draft) => (
                <li key={draft.id}>
                  <Link to={paths.draft(draft.id)} className="t">
                    {draft.playbook.replace(/_/g, ' ')}, version {draft.version}
                  </Link>
                  <span className="muted small">{draft.status}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
