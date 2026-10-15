import type { StageStat } from '../api';

export default function StageStats({ stats }: { stats: StageStat[] }) {
  return (
    <div className="stage-stats">
      {stats.map((stat) => (
        <span key={stat.label} className={`stage-stat${stat.warn ? ' warn' : ''}`}>
          {stat.warn && '⚠ '}
          <b>{stat.value}</b> {stat.label}
        </span>
      ))}
    </div>
  );
}
