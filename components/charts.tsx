/*
 * Gráficos leves (HTML + SVG), responsivos e com dicas flutuantes (atributo data-tip).
 */
import type { CSSProperties } from 'react';
import { esc, num, pct } from '@/lib/orbi/format';

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}
const ticks = (max: number, n: number) => Array.from({ length: n + 1 }, (_, i) => (max * i) / n);
const every = (labels: string[]) => { const n = labels.length; return n > 20 ? Math.ceil(n / 8) : n > 10 ? 2 : 1; };
const fmt = (v: number) => (v >= 1000 ? num(v / 1000, 1) + ' mil' : num(v, v % 1 ? 1 : 0));
const css = (o: Record<string, any>) => o as CSSProperties;

type Series = { name: string; color: string; values: number[]; area?: boolean; dash?: boolean };

function Axis({ max, ts, unit }: { max: number; ts: number[]; unit?: string }) {
  return <div className="ch-y">{ts.map((t, i) => <span key={i} style={{ bottom: `${(t / max) * 100}%` }}>{fmt(t)}{unit || ''}</span>)}</div>;
}
function Grid({ max, ts }: { max: number; ts: number[] }) {
  return <div className="ch-grid">{ts.map((t, i) => <i key={i} style={{ bottom: `${(t / max) * 100}%` }} />)}</div>;
}
function XLabels({ labels }: { labels: string[] }) {
  const k = every(labels);
  return <div className="ch-x">{labels.map((l, i) => <span key={i}>{i % k === 0 ? l : ''}</span>)}</div>;
}

/** Linhas/áreas. */
export function LineChart({ labels, series, max: fixedMax, unit, height, tipLabels }: { labels: string[]; series: Series[]; max?: number; unit?: string; height?: number; tipLabels?: string[] }) {
  const N = labels.length;
  const max = fixedMax || niceMax(Math.max(1, ...series.flatMap(s => s.values)));
  const ts = ticks(max, 4);
  const y = (v: number) => 100 - (v / max) * 100;
  return (
    <div className="chart" style={css({ '--h': `${height || 220}px` })}>
      <Axis max={max} ts={ts} unit={unit} />
      <div className="ch-plot">
        <Grid max={max} ts={ts} />
        <svg viewBox={`0 0 ${N} 100`} preserveAspectRatio="none" aria-hidden="true">
          {series.map((s, k) => {
            const pts = s.values.map((v, i) => `${i + 0.5},${y(v).toFixed(2)}`).join(' ');
            return (
              <g key={k}>
                {s.area && <polygon points={`0.5,100 ${pts} ${N - 0.5},100`} fill={s.color} opacity=".12" />}
                <polyline points={pts} fill="none" stroke={s.color} strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" strokeDasharray={s.dash ? '5 5' : undefined} />
              </g>
            );
          })}
        </svg>
        <div className="ch-dots">{series.filter(s => !s.dash).flatMap((s, k) => s.values.map((v, i) => <i key={k + '-' + i} className="ch-dot" style={{ left: `${((i + 0.5) / N) * 100}%`, bottom: `${100 - y(v)}%`, background: s.color }} />))}</div>
        <div className="ch-hits">{labels.map((l, i) => (
          <div key={i} data-tip={`<b>${esc(tipLabels ? tipLabels[i] : l)}</b>${series.map(s => `<div><i style="background:${s.color}"></i>${esc(s.name)}: <b>${fmt(s.values[i])}${unit || ''}</b></div>`).join('')}`} />
        ))}</div>
      </div>
      <XLabels labels={labels} />
    </div>
  );
}

/** Barras empilhadas. */
export function StackedBars({ labels, stacks, height, highlightLast, tipLabels }: { labels: string[]; stacks: Series[]; height?: number; highlightLast?: boolean; tipLabels?: string[] }) {
  const totals = labels.map((_, i) => stacks.reduce((a, s) => a + s.values[i], 0));
  const max = niceMax(Math.max(1, ...totals));
  const ts = ticks(max, 4);
  return (
    <div className="chart" style={css({ '--h': `${height || 220}px` })}>
      <Axis max={max} ts={ts} />
      <div className="ch-plot">
        <Grid max={max} ts={ts} />
        <div className="ch-bars">{labels.map((l, i) => (
          <div key={i} className={`ch-col ${highlightLast && i === labels.length - 1 ? 'hl' : ''}`}
            data-tip={`<b>${esc(tipLabels ? tipLabels[i] : l)}</b>${stacks.map(s => `<div><i style="background:${s.color}"></i>${esc(s.name)}: <b>${fmt(s.values[i])}</b></div>`).join('')}<div class="tip-sum">Total: <b>${fmt(totals[i])}</b></div>`}>
            <div className="ch-stack" style={{ height: `${(totals[i] / max) * 100}%` }}>
              {stacks.map((s, k) => (s.values[i] ? <i key={k} style={{ flex: s.values[i], background: s.color }} /> : null))}
            </div>
          </div>
        ))}</div>
      </div>
      <XLabels labels={labels} />
    </div>
  );
}

/** Rosca com legenda. */
export function Donut({ segs, center, sub }: { segs: { label: string; value: number; color: string }[]; center: string; sub?: string }) {
  const total = segs.reduce((a, s) => a + s.value, 0) || 1;
  const R = 42, L = 2 * Math.PI * R;
  const offs = segs.reduce<number[]>((a, s, i) => a.concat([(i ? a[i - 1] : 0) + (i ? (segs[i - 1].value / total) * L : 0)]), []);
  const tip = (s: { label: string; value: number }) => `<b>${esc(s.label)}</b><div>${num(s.value)} · ${pct(s.value, total)}%</div>`;
  return (
    <div className="donut">
      <div className="donut-ring">
        <svg viewBox="0 0 100 100">
          <circle r={R} cx="50" cy="50" fill="none" stroke="var(--line)" strokeWidth="9" />
          {segs.map((s, i) => {
            const len = (s.value / total) * L; const off = -offs[i];
            return <circle key={i} r={R} cx="50" cy="50" fill="none" stroke={s.color} strokeWidth="9" strokeDasharray={`${len} ${L - len}`} strokeDashoffset={off} transform="rotate(-90 50 50)" data-tip={tip(s)} />;
          })}
        </svg>
        <div className="donut-c"><b>{center}</b><span>{sub || ''}</span></div>
      </div>
      <ul className="legend">{segs.map((s, i) => (
        <li key={i} data-tip={tip(s)}><i style={{ background: s.color }} /><span>{s.label}</span><b>{num(s.value)}</b><em>{pct(s.value, total)}%</em></li>
      ))}</ul>
    </div>
  );
}

/** Barras horizontais. */
export function HBars({ items, empty, unit, dec }: { items: { label: string; value: number; color?: string; sub?: string; tip?: string }[]; empty?: string; unit?: string; dec?: number }) {
  if (!items.length) return <p className="muted small">{empty || 'Sem dados no período.'}</p>;
  const max = Math.max(1, ...items.map(i => i.value));
  return (
    <div className="hbars">{items.map((i, k) => (
      <div key={k} className="hbar" data-tip={`<b>${esc(i.label)}</b><div>${i.tip || num(i.value, dec) + (unit || '')}</div>`}>
        <span className="hb-label">{i.label}{i.sub && <small>{i.sub}</small>}</span>
        <span className="hb-track"><i style={{ width: `${(i.value / max) * 100}%`, background: i.color || 'var(--primary)' }} /></span>
        <b className="hb-val">{num(i.value, dec)}{unit || ''}</b>
      </div>
    ))}</div>
  );
}

/** Mapa de calor (linhas × colunas). */
export function Heat({ rows, cols, matrix, unit }: { rows: string[]; cols: string[]; matrix: number[][]; unit?: string }) {
  const max = Math.max(1, ...matrix.flat());
  return (
    <div className="heat" style={css({ '--cols': cols.length })}>
      <span />
      {cols.map(c => <span key={c} className="hx">{c}</span>)}
      {rows.map((r, i) => [
        <span key={'y' + i} className="hy">{r}</span>,
        ...matrix[i].map((v, j) => <i key={i + '-' + j} style={css({ '--a': (v / max).toFixed(3) })} data-tip={`<b>${esc(r)} · ${esc(cols[j])}</b><div>${num(v)} ${unit || 'entregas'}</div>`} />)
      ])}
    </div>
  );
}

/** Minigráfico de tendência. */
export function Spark({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(1, ...values), min = Math.min(...values);
  const N = values.length;
  const pts = values.map((v, i) => `${((i / Math.max(1, N - 1)) * 100).toFixed(2)},${(36 - ((v - min) / Math.max(1, max - min)) * 30).toFixed(2)}`).join(' ');
  return (
    <svg className="spark" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
      <polygon points={`0,40 ${pts} 100,40`} fill={color} opacity=".12" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
