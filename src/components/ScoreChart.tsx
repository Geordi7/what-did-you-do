import { createMemo, createSignal, For, Show } from 'solid-js';
import type { ChartRange } from '../types';
import { store } from '../store';
import { scoreBars, type ScoreBar as Bar } from '../scores';

const TOOLTIP_OFFSET = 8;
/** The zero line sits mid-chart, so a full-scale value spans half the chart's height. */
const HALF_SCALE = 50;

const RANGES: Array<{ value: ChartRange; label: string }> = [
  { value: '28d', label: 'Last 28 days' },
  { value: '26w', label: 'Last 26 weeks' },
];

export default function ScoreChart(props: { isLight: boolean; now: () => Date }) {
  const bars = createMemo(() => scoreBars(store.calendars, props.now(), store.chartRange));

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
                        style={{ bottom: `calc(${HALF_SCALE + scaled(bar.pos)}% - var(--score-marker) / 2)` }}
                      />
                    </Show>
                    <Show when={bar.neg < 0}>
                      <div
                        class="score-dot score-dot-neg"
                        style={{ top: `calc(${HALF_SCALE + scaled(bar.neg)}% - var(--score-marker) / 2)` }}
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
