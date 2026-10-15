import { STAGE_STORY, type ProductSummary } from '../api';
import StageRow from './StageRow';
import { useStageRuns } from './use-stage-runs';

export default function ProductStages({ product, showLabel, onOpen, onAsk, onError }: { product: ProductSummary; showLabel: boolean; onOpen: (stage: number) => void; onAsk: (text: string) => void; onError: (message: string) => void }) {
  const stages = useStageRuns(product.id, onError);
  return (
    <section className="product-stages">
      {showLabel && <h2 className="product-stages-label">{product.label.replace(/^https?:\/\//, '')}</h2>}
      <ol className="stage-steps">
        {stages.map(({ stage, summary, run }, i) => (
          <li key={stage} className="stage-step">
            <div className="stage-rail">
              <span className={`stage-bubble ${summary ? summary.status : 'none'}`}>{stage}</span>
              {i < stages.length - 1 && <span className="stage-line" />}
            </div>
            <div className="stage-body">
              <StageRow stage={stage} summary={summary} run={run} onOpen={() => onOpen(stage)} onAsk={() => onAsk(`Run stage ${stage}, ${STAGE_STORY[stage].title.toLowerCase()}, for ${product.label}`)} />
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
