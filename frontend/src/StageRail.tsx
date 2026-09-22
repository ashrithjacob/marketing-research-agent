import type { NodeStatus, ResearchNode, RunStatus, Saturation } from './api';

/**
 * The compartment's six stages and its gate.
 *
 * Stages 3-6 render as `not built` rather than being hidden. The rail is the
 * framework's dependency graph, and showing most of it greyed out is an accurate
 * picture of where this is — hiding them would suggest a finished run had done
 * more of the work than it has.
 *
 * **Revised 2026-09-21: review mining left stage 1 and became stage 2.** It is
 * the only node with paid tools, the only one a product can be structurally
 * unable to satisfy, and its failures say nothing about the other three. As the
 * fourth node of stage 1 it could sink a packet that had already described the
 * product, its competitors and its category.
 */

const STAGES = [
  { id: '1', name: 'Raw material', note: 'product, competitors, category', nodes: 1 },
  { id: '2', name: 'Review mining', note: 'verbatim customer language', nodes: 2 },
  { id: '3', name: 'Product truth', note: 'product in isolation' },
  { id: '4', name: 'Market truth', note: 'product vs world' },
  { id: 'gate', name: 'Viability gate', note: 'human decision' },
  { id: '5', name: 'Customer truth', note: 'after the gate only' },
  { id: '6', name: 'Synthesis', note: 'artifacts leave here' },
] as const;

export const NODE_LABELS: Record<ResearchNode, string> = {
  product_data: 'Product data',
  competitors: 'Competitors',
  review_mining: 'Review mining',
  category_data: 'Category data',
};

/** Which nodes each collecting stage owns. Mirrors STAGE_NODES in the server. */
export const STAGE_NODES: Record<1 | 2, ResearchNode[]> = {
  1: ['product_data', 'competitors', 'category_data'],
  2: ['review_mining'],
};

export const NODE_ORDER: ResearchNode[] = [
  'product_data',
  'competitors',
  'review_mining',
  'category_data',
];

/** The stage a node is collected in. */
export function stageOfNode(node: ResearchNode): 1 | 2 {
  return node === 'review_mining' ? 2 : 1;
}

function runState(status: RunStatus): { cls: string; label: string } {
  switch (status) {
    case 'queued':
      return { cls: 'active', label: 'starting' };
    case 'running':
      return { cls: 'active', label: 'running' };
    case 'stopping':
      return { cls: 'active', label: 'stopping' };
    case 'completed':
      return { cls: 'done', label: 'complete' };
    case 'invalid':
      return { cls: 'blocked', label: 'packet rejected' };
    case 'failed':
      return { cls: 'blocked', label: 'failed' };
    case 'cancelled':
      return { cls: 'blocked', label: 'cancelled' };
    default:
      return { cls: '', label: 'not started' };
  }
}

/** "Product data" for one node, "Whole stage" for all of the stage's nodes. */
export function scopeLabel(nodes: readonly ResearchNode[]): string {
  if (nodes.length === 0) return 'Whole stage';
  const stage = stageOfNode(nodes[0]);
  if (nodes.length === STAGE_NODES[stage].length) {
    return stage === 2 ? 'Review mining' : 'Whole stage';
  }
  return nodes.map((n) => NODE_LABELS[n]).join(' + ');
}

export default function StageRail({
  status,
  nodes,
  saturation,
  scope,
  onRunNode,
  stageTwoReady,
}: {
  status: RunStatus | null;
  nodes: NodeStatus[];
  saturation: Saturation[];
  /** The nodes the shown run covers; the others are marked as not in it. */
  scope: readonly ResearchNode[];
  /** Start a run on one node, or on a whole stage. */
  onRunNode?: (node: ResearchNode) => void;
  /** Stage 2 mines what stage 1 found, so it waits for a completed stage 1 on
   *  this brief. Null when there is no run on screen to judge it by. */
  stageTwoReady?: boolean;
}) {
  const byNode = new Map(nodes.map((n) => [n.node, n]));
  // Competitors carry two curves, one per class; every other node has one.
  const curves = new Map<ResearchNode, Saturation[]>();
  for (const entry of saturation) curves.set(entry.node, [...(curves.get(entry.node) ?? []), entry]);
  const inScope = new Set(scope);

  return (
    <div className="rail">
      <h3>Stages</h3>
      {STAGES.map((stage) => {
        const collects = 'nodes' in stage ? (stage.nodes as 1 | 2) : null;
        // The run on screen belongs to one stage; only that stage shows its state.
        const shown = collects !== null && scope.length > 0 && stageOfNode(scope[0]) === collects;
        const state = shown && status ? runState(status) : null;
        return (
          <div key={stage.id}>
            <div className={`stage ${state?.cls ?? 'unbuilt'}`}>
              <span className="dot" />
              <div>
                <div className="stage-t">
                  {stage.id !== 'gate' ? `Stage ${stage.id} · ` : ''}
                  {stage.name}
                </div>
                <div className="stage-s">
                  {state
                    ? state.label
                    : collects === 2 && stageTwoReady === false
                      ? 'needs a completed stage 1'
                      : collects !== null
                        ? stage.note
                        : 'not built'}
                </div>
              </div>
            </div>
            {collects !== null && (
              <div className="node-list">
                {STAGE_NODES[collects].map((node) => {
                  const record = byNode.get(node);
                  const covered = inScope.size === 0 || inScope.has(node);
                  const cls = !covered
                    ? 'out'
                    : !record
                      ? ''
                      : record.status === 'complete' && record.done_criterion_met
                        ? 'done'
                        : 'partial';
                  return (
                    <div
                      key={node}
                      className={`node ${cls}`}
                      title={covered ? (record?.why ?? '') : 'not in this run'}
                    >
                      <span className="node-dot" />
                      <span className="node-name">{NODE_LABELS[node]}</span>
                      {covered && (curves.get(node) ?? []).length > 0 ? (
                        (curves.get(node) ?? []).map((entry, i) => <Curve key={i} entry={entry} />)
                      ) : (
                        <Curve />
                      )}
                      {onRunNode && (
                        <button
                          className="node-run"
                          disabled={collects === 2 && stageTwoReady === false}
                          title={
                            collects === 2 && stageTwoReady === false
                              ? 'Stage 2 mines what stage 1 found — run stage 1 for this brief first'
                              : `Run ${NODE_LABELS[node]} on its own`
                          }
                          aria-label={`Run ${NODE_LABELS[node]}`}
                          onClick={() => onRunNode(node)}
                        >
                          ▶
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * The saturation curve as a sparkline: new themes per additional source.
 *
 * This is the one place "done" is visible as a measurement rather than an
 * assertion. A curve that flattens is a node that stopped yielding; a curve
 * that flattens at source three every time means the threshold is too eager.
 */
function Curve({ entry }: { entry?: Saturation }) {
  if (!entry || entry.curve.length === 0) return <span className="node-why">—</span>;
  const peak = Math.max(1, ...entry.curve.map((p) => p.new_themes));
  return (
    <span
      className="spark"
      title={`${entry.class ? `${entry.class}: ` : ''}${entry.stopped_because ?? ''}`}
    >
      {entry.curve.map((point, index) => (
        <i
          key={index}
          style={{ height: `${Math.max(2, (point.new_themes / peak) * 14)}px` }}
        />
      ))}
    </span>
  );
}
