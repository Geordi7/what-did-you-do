import { createEffect, createMemo, createSignal, For, onCleanup, Show } from 'solid-js';
import type { ChartRange } from '../types';
import { store } from '../store';
import { scoreBars, type ScoreBar as Bar } from '../scores';

const TOOLTIP_OFFSET = 8;
const TOOLTIP_ID = 'score-tooltip';
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

  /** Positions are relative to the bar wrap the tooltip lives in; `minX`/`maxX` are the card's edges. */
  const [tooltip, setTooltip] = createSignal<{ key: string; x: number; y: number; minX: number; maxX: number } | null>(null);
  /** Key of the column whose breakdown is pinned open, if any. */
  const [pinned, setPinned] = createSignal<string | null>(null);
  const [tooltipLeft, setTooltipLeft] = createSignal(0);
  let tooltipEl: HTMLDivElement | undefined;

  const current = createMemo(() => {
    const key = tooltip()?.key;
    return bars().find(bar => bar.key === key);
  });

  /** Places the tooltip below the chart card, centred on the column. */
  function showTooltip(target: HTMLElement, bar: Bar) {
    const chart = target.closest('.score-chart');
    const wrap = target.closest('.score-bar-wrap');
    if (!chart || !wrap) return;
    const rect = target.getBoundingClientRect();
    const origin = wrap.getBoundingClientRect();
    const card = chart.getBoundingClientRect();
    setTooltip({
      key: bar.key,
      x: rect.left - origin.left + rect.width / 2,
      y: card.bottom - origin.top,
      minX: card.left - origin.left,
      maxX: card.right - origin.left,
    });
  }

  /** Hover and focus only drive the tooltip while nothing is pinned. */
  function hover(target: HTMLElement, bar: Bar) {
    if (pinned() === null) showTooltip(target, bar);
  }

  function unhover() {
    if (pinned() === null) setTooltip(null);
  }

  function togglePin(target: HTMLElement, bar: Bar) {
    if (pinned() === bar.key) {
      setPinned(null);
    } else {
      showTooltip(target, bar);
      setPinned(bar.key);
    }
  }

  /** Closing leaves the collapsed tooltip on a focused column, as focusing it would. */
  function unpin() {
    setPinned(null);
    const focused = document.activeElement;
    const bar = focused instanceof HTMLElement && focused.classList.contains('score-bar-hit')
      ? bars().find(b => b.key === focused.dataset.key)
      : undefined;
    if (bar) showTooltip(focused as HTMLElement, bar);
    else setTooltip(null);
  }

  createEffect(() => {
    if (pinned() === null) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!(e.target instanceof Element) || !e.target.closest('.score-bar-hit, .score-tooltip')) unpin();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') unpin();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    onCleanup(() => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    });
  });

  // Once rendered, the tooltip's width is known: shift it inward to stay within the card.
  createEffect(() => {
    const tip = tooltip();
    current();
    pinned();
    if (!tip || !tooltipEl) return;
    const width = tooltipEl.offsetWidth;
    setTooltipLeft(Math.max(tip.minX, Math.min(tip.x - width / 2, tip.maxX - width)));
  });

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
                    <Show when={bar.pos > 0}>
                      <div class="score-total score-total-pos" style={{ height: `${scaled(bar.pos)}%` }} />
                    </Show>
                    <Show when={bar.neg < 0}>
                      <div class="score-total score-total-neg" style={{ height: `${scaled(bar.neg)}%` }} />
                    </Show>
                    <Show when={bar.net !== 0}>
                      <div
                        class="score-net"
                        classList={{
                          'score-net-gold': bar.neg === 0,
                          'score-net-up': bar.neg !== 0 && bar.net > 0,
                          'score-net-down': bar.net < 0,
                        }}
                        style={{
                          bottom: `calc(${HALF_SCALE + Math.sign(bar.net) * scaled(bar.net)}% - var(--score-marker) / 2)`,
                        }}
                      />
                    </Show>
                  </div>
                  <div
                    class="score-bar-hit"
                    data-key={bar.key}
                    onMouseEnter={(e) => hover(e.currentTarget, bar)}
                    onMouseLeave={unhover}
                    onFocusIn={(e) => hover(e.currentTarget, bar)}
                    onFocusOut={unhover}
                    onClick={(e) => togglePin(e.currentTarget, bar)}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter' && e.key !== ' ') return;
                      e.preventDefault();
                      togglePin(e.currentTarget, bar);
                    }}
                    tabindex="0"
                    role="button"
                    aria-expanded={pinned() === bar.key}
                    aria-describedby={pinned() === bar.key ? TOOLTIP_ID : undefined}
                    aria-label={`${bar.label}: +${bar.pos.toFixed(1)} ${bar.neg.toFixed(1)} → net ${bar.net.toFixed(1)}`}
                  />
                </div>
              );
            }}
          </For>
        </div>
        <div class="score-zero-line" />
        <Show when={current()}>
          {(bar) => (
            <div
              ref={tooltipEl}
              id={TOOLTIP_ID}
              class="score-tooltip"
              classList={{ 'score-tooltip-pinned': pinned() === bar().key }}
              style={{
                left: `${tooltipLeft()}px`,
                top: `${tooltip()!.y + TOOLTIP_OFFSET}px`,
                'max-width': `${tooltip()!.maxX - tooltip()!.minX}px`,
              }}
            >
              <div class="score-tooltip-date">{bar().label}</div>
              <div class="score-tooltip-pos">+{bar().pos.toFixed(1)}</div>
              <div class="score-tooltip-neg">{bar().neg.toFixed(1)}</div>
              <div class="score-tooltip-net">net: {bar().net.toFixed(1)}</div>
              <Show when={pinned() === bar().key}>
                <Show
                  when={bar().activities.length > 0}
                  fallback={<div class="score-activity-empty">No activity</div>}
                >
                  <ul class="score-activities">
                    <For each={bar().activities}>
                      {(activity) => (
                        <li class="score-activity">
                          <span class="score-activity-name">{activity.name}</span>
                          <span class="score-activity-count">×{activity.count}</span>
                          <span
                            class="score-activity-score"
                            classList={{
                              'score-activity-pos': activity.score > 0,
                              'score-activity-neg': activity.score < 0,
                            }}
                          >
                            {activity.score > 0 ? '+' : ''}{activity.score.toFixed(1)}
                          </span>
                        </li>
                      )}
                    </For>
                  </ul>
                </Show>
              </Show>
            </div>
          )}
        </Show>
      </div>
    </div>
  );
}
