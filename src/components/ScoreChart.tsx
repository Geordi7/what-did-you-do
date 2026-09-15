import { createMemo, For, createSignal, Show } from 'solid-js';
import { store } from '../store';
import { buildGrid, dateKey, parseKey } from '../utils';

const WEEKS = 26;
const BAR_GAP = 1;
const TOOLTIP_OFFSET = 8;

function formatDate(d: Date): string {
  return d.toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ScoreChart(props: { isLight: boolean }) {
  const weeks = createMemo(() => buildGrid(new Date(), WEEKS));

  const dayScores = createMemo(() => {
    const posMap: Record<string, number> = {};
    const negMap: Record<string, number> = {};
    const active = store.activeCalendars;
    for (const cal of active) {
      for (const [key, count] of Object.entries(cal.days)) {
        const contrib = count * cal.activityValue;
        if (contrib > 0) {
          posMap[key] = (posMap[key] ?? 0) + contrib;
        } else if (contrib < 0) {
          negMap[key] = (negMap[key] ?? 0) + contrib;
        }
      }
    }
    const netMap: Record<string, number> = {};
    for (const key of new Set([...Object.keys(posMap), ...Object.keys(negMap)])) {
      netMap[key] = (posMap[key] ?? 0) + (negMap[key] ?? 0);
    }
    return { pos: posMap, neg: negMap, net: netMap };
  });

  const maxAbs = createMemo(() => {
    let max = 0;
    for (const v of Object.values(dayScores().pos)) max = Math.max(max, v);
    for (const v of Object.values(dayScores().neg)) max = Math.max(max, Math.abs(v));
    return max || 1;
  });

  const [tooltip, setTooltip] = createSignal<{
    key: string; pos: number; neg: number; net: number; x: number; y: number;
  } | null>(null);

  const calColor = createMemo(() => {
    const active = store.activeCalendars;
    if (active.length > 0) return active[0].color;
    return '#58a6ff';
  });

  const total = createMemo(() => Object.values(dayScores().net).reduce((a, b) => a + b, 0));

  return (
    <div class="score-chart">
      <div class="score-chart-title">Daily Score</div>
      <div class="score-bar-wrap">
        <div class="score-bars">
          <For each={weeks().flat()}>
            {(date) => {
              const key = dateKey(date);
              const pos = dayScores().pos[key] ?? 0;
              const neg = dayScores().neg[key] ?? 0;
              const net = dayScores().net[key] ?? 0;
              const m = maxAbs();

              const netH = (Math.abs(net) / m) * 100;
              const posDotY = pos > 0 ? (pos / m) * 100 : 0;
              const negDotY = neg < 0 ? (Math.abs(neg) / m) * 100 : 0;

              const barStyle = net >= 0
                ? { height: `${netH}%`, 'background-color': calColor() }
                : { height: `${netH}%`, 'background-color': calColor(), 'align-self': 'flex-start' };

              return (
                <div class="score-bar-col" style={{ 'margin-left': `${BAR_GAP}px` }}>
                  <div class="score-bar-inner" style={{ position: 'relative', width: '100%', height: '100%' }}>
                    {/* net bar */}
                    <div
                      class="score-netbar"
                      style={net !== 0 ? {
                        position: 'absolute',
                        bottom: net >= 0 ? '50%' : 'auto',
                        top: net < 0 ? '50%' : 'auto',
                        width: '100%',
                        height: `${netH}%`,
                        'background-color': net >= 0 ? '#4caf50' : '#f44336',
                        'border-radius': '1px 1px 0 0',
                      } : { display: 'none' }}
                    />
                    {/* positive dot */}
                    {pos > 0 && (
                      <div
                        class="score-dot score-dot-pos"
                        style={{
                          position: 'absolute',
                          bottom: `${50 + posDotY - 2}%`,
                          width: '100%',
                          height: '4px',
                          'background-color': '#4caf50',
                          'border-radius': '50%',
                        }}
                      />
                    )}
                    {/* negative dot */}
                    {neg < 0 && (
                      <div
                        class="score-dot score-dot-neg"
                        style={{
                          position: 'absolute',
                          top: `${50 + negDotY - 2}%`,
                          width: '100%',
                          height: '4px',
                          'background-color': '#f44336',
                          'border-radius': '50%',
                        }}
                      />
                    )}
                  </div>
                  {/* invisible hit target for tooltip */}
                  <div
                    class="score-bar-hit"
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => {
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      const parent = (e.currentTarget as HTMLElement).closest('.score-chart')!.getBoundingClientRect();
                      setTooltip({
                        key, pos, neg, net,
                        x: rect.left - parent.left + rect.width / 2,
                        y: rect.top - parent.top,
                      });
                    }}
                    onMouseLeave={() => setTooltip(null)}
                    onFocusIn={(e) => {
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      const parent = (e.currentTarget as HTMLElement).closest('.score-chart')!.getBoundingClientRect();
                      setTooltip({
                        key, pos, neg, net,
                        x: rect.left - parent.left + rect.width / 2,
                        y: rect.top - parent.top,
                      });
                    }}
                    onFocusOut={() => setTooltip(null)}
                    tabindex="0"
                    role="img"
                    aria-label={`${formatDate(date)}: +${pos.toFixed(1)} ${neg.toFixed(1)} → net ${net.toFixed(1)}`}
                  />
                </div>
              );
            }}
          </For>
        </div>
        {/* zero line */}
        <div class="score-zero-line" />
        {tooltip() && (
          <div
            class="score-tooltip"
            style={{
              left: `${tooltip()!.x}px`,
              top: `${tooltip()!.y - TOOLTIP_OFFSET}px`,
            }}
          >
            <div class="score-tooltip-date">{formatDate(parseKey(tooltip()!.key))}</div>
            <div class="score-tooltip-pos">+{tooltip()!.pos.toFixed(1)}</div>
            <div class="score-tooltip-neg">{tooltip()!.neg.toFixed(1)}</div>
            <div class="score-tooltip-net">net: {tooltip()!.net.toFixed(1)}</div>
          </div>
        )}
      </div>
      <div class="score-total-label">Total: {total().toFixed(1)}</div>
    </div>
  );
}