import type { NodeStatus, ResearchNode, RunStatus, Saturation } from './api';
import { NODE_LABELS, STAGE_NODES, stageOfNode, type CollectingStage } from './stages';

const STAGES = [
  { id: '1', name: 'Raw material', note: 'product, competitors, category', nodes: 1 },
  { id: '2', name: 'Product truth', note: 'product in isolation', nodes: 2 },
  { id: '3', name: 'Review mining', note: 'verbatim customer language', nodes: 3 },
  { id: '4', name: 'Market truth', note: 'product vs world' },
  { id: 'gate', name: 'Viability gate', note: 'human decision' },
  { id: '5', name: 'Customer truth', note: 'after the gate only' },
  { id: '6', name: 'Synthesis', note: 'artifacts leave here' },
] as const;

const START_TITLE: Record<CollectingStage, string> = {
  1: '',
  2: 'Assess the product stage 1 found, in isolation — you enter its landed cost before it runs',
  3: 'Mine reviews for the product stage 1 found — you approve the plan before it runs',
};

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

/** A stage's standing when the shown run is not the one collecting it: each later stage needs the one before it complete, on the same stage-1 run. */
function standing(collects: CollectingStage, progress: StageProgress | undefined): { cls: string; label: string } | null {
  if (!progress) return null;
  if (collects === 1) return progress.done[1] ? { cls: 'done', label: 'complete' } : null;
  if (progress.live[collects]) return { cls: 'active', label: 'running in another run' };
  if (progress.done[collects]) return { cls: 'done', label: 'complete' };
  if (progress.done[(collects - 1) as CollectingStage]) return { cls: 'ready', label: `ready — stage ${collects - 1} is complete` };
  return { cls: 'unbuilt', label: `needs a completed stage ${collects - 1}` };
}

export interface StageProgress {
  /** Which collecting stages have a completed run on the stage-1 run the shown run belongs to. */
  done: Record<CollectingStage, boolean>;
  /** Which of them have a run queued or running right now. */
  live: Record<CollectingStage, boolean>;
  /** The run each collecting stage opens when its header is clicked. */
  runIds?: Partial<Record<CollectingStage, string>>;
  /** On a stage-2 or stage-3 run: a completed stage-1 run newer than the one it built on, so what it found is out of date. */
  newerStageOne?: { id: string; created_at: string };
}

export default function StageRail({
  status,
  nodes,
  saturation,
  scope,
  onRunNode,
  progress,
  onSelectRun,
}: {
  status: RunStatus | null;
  nodes: NodeStatus[];
  saturation: Saturation[];
  /** The nodes the shown run covers; the others are marked as not in it. */
  scope: readonly ResearchNode[];
  /** Start a run on one node, or on a whole stage. */
  onRunNode?: (node: ResearchNode) => void;
  /** Where this subject stands across all its runs. */
  progress?: StageProgress;
  /** Open the run that collected a stage. */
  onSelectRun?: (id: string) => void;
}) {
  const byNode = new Map(nodes.map((n) => [n.node, n]));
  const curves = new Map<ResearchNode, Saturation[]>();
  for (const entry of saturation) curves.set(entry.node, [...(curves.get(entry.node) ?? []), entry]);
  const inScope = new Set(scope);
  const blocked = (stage: CollectingStage) => stage > 1 && !!progress && !progress.done[(stage - 1) as CollectingStage];

  return (
    <div className="rail">
      <h3>Stages</h3>
      {STAGES.map((stage) => {
        const collects = 'nodes' in stage ? (stage.nodes as CollectingStage) : null;
        const shown = collects !== null && scope.length > 0 && stageOfNode(scope[0]) === collects;
        const rerun = shown && collects !== 1 && progress?.newerStageOne ? { cls: 'ready', label: 'ready — stage 1 was rerun' } : null;
        const state =
          rerun ?? (shown && status ? runState(status) : collects !== null ? standing(collects, progress) : null);
        const ready = collects !== null && collects !== 1 && state?.cls === 'ready';
        const target = collects !== null && !shown ? progress?.runIds?.[collects] : undefined;
        const open = target && onSelectRun ? () => onSelectRun(target) : undefined;
        return (
          <div key={stage.id}>
            <div
              className={`stage ${state?.cls || 'unbuilt'}${open ? ' linked' : ''}`}
              role={open ? 'link' : undefined}
              tabIndex={open ? 0 : undefined}
              title={open ? `Open the stage ${collects} run` : undefined}
              onClick={open}
              onKeyDown={open ? (e) => e.key === 'Enter' && open() : undefined}
            >
              <span className="dot" />
              <div className="stage-body">
                <div className="stage-t">
                  {stage.id !== 'gate' ? `Stage ${stage.id} · ` : ''}
                  {stage.name}
                </div>
                <div className="stage-s">
                  {state ? state.label : collects !== null ? stage.note : 'not built'}
                </div>
                {ready && collects && onRunNode && (
                  <button
                    className="primary stage-start"
                    title={START_TITLE[collects]}
                    onClick={(e) => {
                      e.stopPropagation();
                      onRunNode(STAGE_NODES[collects][0]);
                    }}
                  >
                    Start stage {collects} →
                  </button>
                )}
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
                          disabled={blocked(collects)}
                          title={
                            blocked(collects)
                              ? `Stage ${collects} builds on stage ${collects - 1} — complete that first`
                              : collects === 2
                                ? 'Run product truth: its four nodes run together'
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
