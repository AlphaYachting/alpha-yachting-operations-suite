import AgentItemRow from './AgentItemRow';
import { cn } from '@/lib/utils';

export default function AgentSection({ title, subtitle, items, ranked = false, emptyMessage, colorClass = 'bg-slate-50 border-slate-200', badge, badgeClass, technicians, onRefresh }) {
  return (
    <section>
      <div className="flex items-center gap-3 mb-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-slate-800">{title}</h2>
            {badge != null && (
              <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', badgeClass || 'bg-slate-100 text-slate-600')}>
                {badge}
              </span>
            )}
          </div>
          {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
      </div>

      {items.length === 0 ? (
        <div className={cn('rounded-xl border px-4 py-6 text-center text-sm text-slate-400', colorClass)}>
          {emptyMessage}
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item, idx) => (
            <AgentItemRow
              key={item.workOrder.id}
              item={item}
              rank={ranked ? idx + 1 : null}
              technicians={technicians}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      )}
    </section>
  );
}