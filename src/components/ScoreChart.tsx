import { createMemo, createSignal, For, onCleanup, Show } from 'solid-js';
import type { ChartRange } from '../types';
import { store } from '../store';
import { buildGrid, dateKey, formatDate } from '../utils';

const DAILY_BARS = 28;
const WEEKLY_BARS = 26;
const TOOLTIP_OFFSET = 8;
/** The zero line sits mid-chart, so a full-scale value spans half the chart's height. */
const HALF_SCALE = 50;

const RANGES: Array<{ value: ChartRange; label: string }> = [
  { value: '28d', label: 'Last 28 days' },
  { value: '26w', label: 'Last 26 weeks' },
];

interface Bar {
  key: string;
  label: string;
  pos: number;
  neg: number;
  net: number;
}

function useNow(): () => Date {
  const [now, setNow] = createSignal(new Date());
  const tick = () => {
    const next = new Date();
    setNow(next);
    const msToMidnight =
      new Date(next.getFullYear(), next.getMonth(), next.getDate() + 1, 0, 0, 0, 0).getTime() - next.getTime() + 1000;
    return setTimeout(tick, msToMidnight);
  };
  const id = tick();
  onCleanup(() => clearTimeout(id));
  return now;
}

export default function ScoreChart(props: { isLight: boolean }) {
  const now = useNow();

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
    return { pos: posMap, neg: negMap };
  });

  const bars = createMemo<Bar[]>(() => {
    const scores = dayScores();
    const today = now();

    if (store.chartRange === '26w') {
      return buildGrid(today, WEEKLY_BARS).map((week) => {
        let pos = 0;
        let neg = 0;
        for (const date of week) {
          const key = dateKey(date);
          pos += scores.pos[key] ?? 0;
          neg += scores.neg[key] ?? 0;
        }
        return {
          key: dateKey(week[0]),
          label: `Week of ${formatDate(week[0])}`,
          pos,
          neg,
          net: pos + neg,
        };
      });
    }

    const out: Bar[] = [];
    for (let i = DAILY_BARS - 1; i >= 0; i--) {
      const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
      const key = dateKey(date);
      const pos = scores.pos[key] ?? 0;
      const neg = scores.neg[key] ?? 0;
      out.push({ key, label: formatDate(date), pos, neg, net: pos + neg });
    }
    return out;
  });

  const maxAbs = createMemo(() => {
    let max = 0;
    for (const bar of bars()) {
      max = Math.max(max, bar.pos, Math.abs(bar.neg));
    }
    return max || 1;
  });

  const [tooltip, setTooltip] = createSignal<Bar & { x: number; y: number } | null>(null);

  function showTooltip(target: HTMLElement, bar: Bar) {
    const chart = target.closest('.score-chart');
    if (!chart) return;
    const rect = target.getBoundingClientRect();
    const parent = chart.getBoundingClientRect();
    setTooltip({
      ...bar,
      x: rect.left - parent.left + rect.width / 2,
      y: rect.top - parent.top,
    });
  }

  return (
    <div class="score-chart">
      <div class="score-chart-header">
        <div class="score-chart-title">Daily Score</div>
        <div class="score-range" role="group" aria-label="Chart range">
          <For each={RANGES}>
            {(range) => (
              <button
                type="button"
                class="score-range-btn"
                classList={{ active: store.chartRange === range.value }}
                aria-pressed={store.chartRange === range.value}
                onClick={() => store.setChartRange(range.value)}
              >
                {range.label}
              </button>
            )}
          </For>
        </div>
      </div>
      <div class="score-bar-wrap">
        <div class="score-bars">
          <For each={bars()}>
            {(bar) => {
              const scaled = (value: number) => (Math.abs(value) / maxAbs()) * HALF_SCALE;

              return (
                <div class="score-bar-col">
                  <div class="score-bar-inner">
                    <Show when={bar.net !== 0}>
                      <div
                        class="score-netbar"
                        classList={{
                          'score-netbar-up': bar.net >= 0,
                          'score-netbar-down': bar.net < 0,
                        }}
                        style={{ height: `${scaled(bar.net)}%` }}
                      />
                    </Show>
                    <Show when={bar.pos > 0}>
                      <div
                        class="score-dot score-dot-pos"
                        style={{ bottom: `calc(${HALF_SCALE + scaled(bar.pos)}% - 1px)` }}
                      />
                    </Show>
                    <Show when={bar.neg < 0}>
                      <div
                        class="score-dot score-dot-neg"
                        style={{ top: `calc(${HALF_SCALE + scaled(bar.neg)}% - 1px)` }}
                      />
                    </Show>
                  </div>
                  <div
                    class="score-bar-hit"
                    onMouseEnter={(e) => showTooltip(e.currentTarget, bar)}
                    onMouseLeave={() => setTooltip(null)}
                    onFocusIn={(e) => showTooltip(e.currentTarget, bar)}
                    onFocusOut={() => setTooltip(null)}
                    tabindex="0"
                    role="img"
                    aria-label={`${bar.label}: +${bar.pos.toFixed(1)} ${bar.neg.toFixed(1)} → net ${bar.net.toFixed(1)}`}
                  />
                </div>
              );
            }}
          </For>
        </div>
        <div class="score-zero-line" />
        <Show when={tooltip()}>
          {(tip) => (
            <div
              class="score-tooltip"
              style={{
                left: `${tip().x}px`,
                top: `${tip().y - TOOLTIP_OFFSET}px`,
              }}
            >
              <div class="score-tooltip-date">{tip().label}</div>
              <div class="score-tooltip-pos">+{tip().pos.toFixed(1)}</div>
              <div class="score-tooltip-neg">{tip().neg.toFixed(1)}</div>
              <div class="score-tooltip-net">net: {tip().net.toFixed(1)}</div>
            </div>
          )}
        </Show>
      </div>
    </div>
  );
}
