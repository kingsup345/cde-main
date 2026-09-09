import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ReferenceArea,
  ReferenceDot
} from 'recharts';
import { Target, ShieldAlert, Crosshair, DollarSign, Loader2, Activity, ShoppingBag, TrendingUp, TrendingDown } from 'lucide-react';
import { formatFullPrice } from '@/utils/formatPrice';
import { fetchTimeframe, getAggregatedCandles } from '@cde/engine/market-data';

const FIVE_MIN_MS = 300_000;
/** Bars of pre-entry context to show on the 5-minute chart. */
const CONTEXT_BARS = 24;
/** Hard cap on how many 5m bars to pull for a long-held position (~20h). */
const MAX_5M_BARS = 240;

type Candle = { timestamp: number; open: number; high: number; low: number; close: number };

export interface LivePositionChartProps {
  symbol: string;
  type: 'SPOT' | 'FUTURES';
  side: 'BUY' | 'SELL' | 'LONG' | 'SHORT';
  entryPrice: number;
  currentPrice: number;
  quantity?: number;
  openedAt?: string;
  openTimestamp?: number;
  stopLoss?: number;
  takeProfit?: number;
  takeProfit1?: number;
  breakEvenPrice?: number;
  leverage?: number;
  unrealizedPnl?: number;
  /** Confidence (0-100) the engine entered this position with — shown as a
   *  holographic overlay on the chart. */
  confidence?: number;
  candles?: Candle[];
}

const fmtClock = (ts: number) =>
  new Date(ts).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
const fmtDay = (ts: number) =>
  new Date(ts).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' });

export const LivePositionChart: React.FC<LivePositionChartProps> = ({
  symbol,
  type,
  side,
  entryPrice,
  currentPrice,
  quantity = 0,
  openedAt,
  openTimestamp,
  stopLoss,
  takeProfit,
  takeProfit1,
  breakEvenPrice,
  leverage = 1,
  unrealizedPnl,
  confidence,
  candles: externalCandles
}) => {
  const [internalCandles, setInternalCandles] = useState<Candle[]>([]);
  const [loadingCandles, setLoadingCandles] = useState(false);
  // false → real 5-minute candles for the holding window; true → had to fall
  // back to the daily aggregate (5m feed unavailable for this symbol).
  const [usingDaily, setUsingDaily] = useState(false);
  const hasDataRef = useRef(false);

  const isLong = side === 'BUY' || side === 'LONG';
  const effectiveTP = takeProfit || takeProfit1;
  const effectiveLeverage = leverage > 0 ? leverage : 1;

  // PnL calculations
  const priceDiff = isLong ? currentPrice - entryPrice : entryPrice - currentPrice;
  const pnlPercent = entryPrice > 0 ? (priceDiff / entryPrice) * 100 * effectiveLeverage : 0;

  const effectivePnl = unrealizedPnl !== undefined
    ? unrealizedPnl
    : (quantity > 0 ? priceDiff * quantity * effectiveLeverage : 0);

  const isProfitable = effectivePnl >= 0;
  const moveColor = isProfitable ? '#10b981' : '#f43f5e';

  const hasConfidence = typeof confidence === 'number' && confidence > 0;
  const heldMs = openTimestamp ? Math.max(0, Date.now() - openTimestamp) : 0;
  const heldLabel = openTimestamp
    ? heldMs < 3_600_000
      ? `${Math.max(1, Math.round(heldMs / 60_000))} דק'`
      : `${(heldMs / 3_600_000).toFixed(1)} שע'`
    : null;

  // ── Fetch 5-minute candles covering the holding window ─────────────────────
  useEffect(() => {
    if (externalCandles && externalCandles.length > 0) {
      setInternalCandles(externalCandles);
      hasDataRef.current = true;
      return;
    }

    let active = true;

    const load = () => {
      if (!hasDataRef.current) setLoadingCandles(true);
      const bars = openTimestamp ? Math.ceil((Date.now() - openTimestamp) / FIVE_MIN_MS) : 0;
      const limit = Math.min(MAX_5M_BARS, Math.max(36, bars + CONTEXT_BARS));

      const daily = () =>
        getAggregatedCandles(symbol, 30).then((c) => {
          if (active && c && c.length) {
            setInternalCandles(c);
            setUsingDaily(true);
            hasDataRef.current = true;
          }
        });

      fetchTimeframe(symbol, '5m', { limit, requireClosed: false, category: 'spot' })
        .then((res) => {
          if (!active) return;
          if (res.candles && res.candles.length > 2) {
            setInternalCandles(res.candles);
            setUsingDaily(false);
            hasDataRef.current = true;
            return;
          }
          return daily();
        })
        .catch(() => daily().catch(() => {}))
        .finally(() => {
          if (active) setLoadingCandles(false);
        });
    };

    load();
    // The 5m feed refreshes on ~45s cadence; re-pull once a minute so the chart
    // keeps extending for as long as the position is open.
    const id = setInterval(load, 60_000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [symbol, externalCandles, openTimestamp]);

  const activeCandles = externalCandles && externalCandles.length > 0 ? externalCandles : internalCandles;
  const entryTs = openTimestamp || activeCandles[0]?.timestamp || Date.now();

  // ── Build split chart data: grey line before the BUY, coloured area after ───
  const chartData = React.useMemo(() => {
    if (!activeCandles || activeCandles.length === 0) return [];

    const rows = usingDaily
      ? activeCandles.slice(-CONTEXT_BARS)
      : activeCandles.filter((c) => c.timestamp >= entryTs - CONTEXT_BARS * FIVE_MIN_MS).slice(-MAX_5M_BARS);

    // Index of the candle that CONTAINS the entry (last one that opened at or
    // before entryTs). Split there and let that one candle belong to BOTH
    // series so the grey "before" line and the coloured "since entry" area meet
    // with no gap. splitIdx = -1 → entry precedes the whole window (all
    // "since entry", no grey); = last → entry is newer than every bar loaded.
    const firstAfter = rows.findIndex((c) => c.timestamp > entryTs);
    const splitIdx = firstAfter === -1 ? rows.length - 1 : firstAfter - 1;

    const out = rows.map((c, i) => ({
      ts: c.timestamp,
      price: c.close,
      priceBefore: i <= splitIdx ? c.close : null,
      priceAfter: i >= splitIdx ? c.close : null
    }));

    // Pin the latest live market price as the final "since entry" point.
    if (currentPrice > 0 && out.length > 0) {
      const now = Date.now();
      const last = out[out.length - 1];
      if (now - last.ts > FIVE_MIN_MS / 2) {
        out.push({ ts: now, price: currentPrice, priceBefore: null, priceAfter: currentPrice });
      } else {
        last.price = currentPrice;
        if (last.priceAfter !== null) last.priceAfter = currentPrice;
      }
    }

    return out;
  }, [activeCandles, usingDaily, entryTs, currentPrice]);

  const xDomain: [number | string, number | string] = chartData.length
    ? [Math.min(chartData[0].ts, entryTs), chartData[chartData.length - 1].ts]
    : ['dataMin', 'dataMax'];
  const lastTs = chartData.length ? chartData[chartData.length - 1].ts : entryTs;
  const tickFmt = usingDaily ? fmtDay : fmtClock;

  // Distance to targets — used by the fallback bar when no candles loaded.
  const slDistancePercent = stopLoss && entryPrice > 0
    ? Math.abs((entryPrice - stopLoss) / entryPrice) * 100
    : 0;
  const tpDistancePercent = effectiveTP && entryPrice > 0
    ? Math.abs((effectiveTP - entryPrice) / entryPrice) * 100
    : 0;

  // ── The BUY flag, pinned to the exact entry candle on the chart ────────────
  const renderBuyFlag = (props: { viewBox?: { x?: number; y?: number; cx?: number; cy?: number } }) => {
    const vb = props.viewBox ?? {};
    const cx = vb.cx ?? vb.x ?? 0;
    const cy = vb.cy ?? vb.y ?? 0;
    const label = `BUY $${formatFullPrice(entryPrice)}`;
    const w = Math.min(180, label.length * 6.6 + 20);
    const arrow = isProfitable ? '▲' : '▼';
    return (
      <g transform={`translate(${cx}, ${cy})`} style={{ pointerEvents: 'none' }}>
        {/* connector from flag down to the dot */}
        <line x1={0} y1={0} x2={0} y2={-14} stroke={isLong ? '#34d399' : '#fb7185'} strokeWidth={1.5} />
        <g transform={`translate(${-w / 2}, ${-38})`}>
          <rect x={-1} y={-1} width={w + 2} height={24} rx={6} fill={isLong ? '#10b981' : '#f43f5e'} opacity={0.3} />
          <rect
            x={0} y={0} width={w} height={22} rx={5}
            fill={isLong ? '#064e3b' : '#881337'}
            stroke={isLong ? '#34d399' : '#fb7185'}
            strokeWidth={1.5}
            filter="drop-shadow(0 2px 4px rgba(0,0,0,0.6))"
          />
          <text x={8} y={15} fill="#ffffff" fontSize={10.5} fontWeight="bold" fontFamily="monospace">
            {label}
          </text>
          <text x={w - 6} y={15} textAnchor="end" fill={moveColor} fontSize={10} fontWeight="bold" fontFamily="monospace">
            {arrow}{Math.abs(pnlPercent).toFixed(2)}%
          </text>
        </g>
      </g>
    );
  };

  return (
    <Card className="border border-border/40 bg-card/60 backdrop-blur-md overflow-hidden transition-all duration-200 hover:border-primary/40">
      {/* scoped holographic styling for the confidence badge */}
      <style>{`
        @keyframes lpcHoloSheen { 0% { transform: translateX(-120%); } 60%,100% { transform: translateX(220%); } }
        @keyframes lpcHoloFloat { 0%,100% { transform: perspective(400px) rotateX(0deg); } 50% { transform: perspective(400px) rotateX(6deg); } }
        .lpc-holo {
          position: absolute; top: 8px; left: 8px; z-index: 5; pointer-events: none;
          padding: 5px 10px; border-radius: 9px; overflow: hidden;
          font-family: monospace; line-height: 1.05;
          background: linear-gradient(135deg, rgba(34,211,238,0.16), rgba(139,92,246,0.16));
          border: 1px solid rgba(56,189,248,0.55);
          box-shadow: 0 0 14px rgba(56,189,248,0.35), inset 0 0 10px rgba(139,92,246,0.25);
          backdrop-filter: blur(3px);
          animation: lpcHoloFloat 5s ease-in-out infinite;
        }
        .lpc-holo::after {
          content: ''; position: absolute; inset: 0; width: 45%;
          background: linear-gradient(100deg, transparent, rgba(255,255,255,0.55), transparent);
          animation: lpcHoloSheen 3.4s ease-in-out infinite;
        }
        .lpc-holo__k { font-size: 8px; letter-spacing: .12em; color: rgba(186,230,253,0.9); text-transform: uppercase; }
        .lpc-holo__v {
          font-size: 15px; font-weight: 800;
          background: linear-gradient(90deg, #67e8f9, #a78bfa);
          -webkit-background-clip: text; background-clip: text; color: transparent;
          text-shadow: 0 0 10px rgba(103,232,249,0.45);
        }
      `}</style>

      <CardHeader className="p-3 pb-2 border-b border-border/30 bg-muted/20">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono font-bold text-base">{symbol}</span>
            <Badge variant="outline" className={type === 'FUTURES' ? 'border-purple-500/50 text-purple-400 bg-purple-500/10' : 'border-cyan-500/50 text-cyan-400 bg-cyan-500/10'}>
              {type} {effectiveLeverage > 1 ? `${effectiveLeverage}x` : ''}
            </Badge>
            <Badge className={isLong ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' : 'bg-rose-500/20 text-rose-400 border-rose-500/40'}>
              {side}
            </Badge>
            <Badge className="bg-primary/20 text-primary border border-primary/40 font-mono text-xs flex items-center gap-1">
              <ShoppingBag className="w-3 h-3" />
              <span>נקנה: ${formatFullPrice(entryPrice)}</span>
              {openedAt && <span className="opacity-80">({openedAt})</span>}
            </Badge>
            {hasConfidence && (
              <Badge variant="outline" className="border-sky-400/50 text-sky-300 bg-sky-400/10 font-mono text-xs">
                ביטחון כניסה {Math.round(confidence!)}%
              </Badge>
            )}
            {heldLabel && (
              <Badge variant="outline" className="border-border/50 text-muted-foreground font-mono text-[11px]">
                מוחזק {heldLabel}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-muted-foreground">מחיר נוכחי:</span>
            <span className="font-mono font-bold text-sm sm:text-base">${formatFullPrice(currentPrice)}</span>
            <Badge className={`${isProfitable ? 'bg-emerald-600' : 'bg-rose-600'} text-white font-mono text-xs shadow-sm flex items-center gap-1`}>
              {isProfitable ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {isProfitable ? '+' : ''}{pnlPercent.toFixed(2)}% ({isProfitable ? '+' : ''}${effectivePnl.toFixed(2)})
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-3 pt-2">
        {loadingCandles && chartData.length === 0 ? (
          <div className="h-36 w-full flex flex-col items-center justify-center gap-2 bg-black/20 rounded-md border border-border/20">
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
            <span className="text-xs font-mono text-muted-foreground">טוען גרף 5 דקות...</span>
          </div>
        ) : chartData.length > 2 ? (
          <div className="relative h-36 w-full">
            {hasConfidence && (
              <div className="lpc-holo">
                <div className="lpc-holo__k">ביטחון כניסה</div>
                <div className="lpc-holo__v">{Math.round(confidence!)}%</div>
              </div>
            )}
            <div className="absolute top-1.5 right-2 z-[5] text-[10px] font-mono text-muted-foreground/80 pointer-events-none">
              {usingDaily ? 'נרות יומיים (5ד׳ לא זמין)' : 'נרות 5 דקות'}
            </div>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 20, right: 12, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id={`grad-${symbol}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={moveColor} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={moveColor} stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="ts"
                  type="number"
                  scale="time"
                  domain={xDomain}
                  stroke="#71717a"
                  fontSize={10}
                  tickLine={false}
                  tickFormatter={tickFmt}
                  minTickGap={40}
                />
                <YAxis stroke="#71717a" fontSize={10} domain={['auto', 'auto']} tickLine={false} width={58}
                  tickFormatter={(v: number) => `$${formatFullPrice(v)}`} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', fontSize: '11px' }}
                  labelFormatter={(ts: number) => (usingDaily ? fmtDay(ts) : `${fmtDay(ts)} ${fmtClock(ts)}`)}
                  formatter={(val: number | string) => [`$${formatFullPrice(Number(val))}`, 'מחיר']}
                />

                {/* Held period tint — the stretch of chart since the BUY */}
                <ReferenceArea x1={entryTs} x2={lastTs} fill={moveColor} fillOpacity={0.06} />

                {/* Price before entry — muted */}
                <Line type="monotone" dataKey="priceBefore" stroke="#64748b" strokeWidth={1.5} dot={false} connectNulls={false} isAnimationActive={false} />
                {/* Price since entry — coloured by the move, filled */}
                <Area type="monotone" dataKey="priceAfter" stroke={moveColor} strokeWidth={2.4} fill={`url(#grad-${symbol})`} connectNulls={false} isAnimationActive={false} />

                {/* Exact entry time */}
                <ReferenceLine x={entryTs} stroke={isLong ? '#10b981' : '#f43f5e'} strokeDasharray="3 3" strokeOpacity={0.7} />
                {/* Entry price level */}
                <ReferenceLine y={entryPrice} stroke={isLong ? '#10b981' : '#f43f5e'} strokeDasharray="4 4" strokeWidth={1.25}
                  label={{ value: 'כניסה', fill: isLong ? '#34d399' : '#fb7185', fontSize: 9, position: 'insideLeft' }} />

                {/* The BUY marker — precise x (entry candle) + y (entry price) */}
                <ReferenceDot
                  x={entryTs}
                  y={entryPrice}
                  r={5}
                  fill={isLong ? '#10b981' : '#f43f5e'}
                  stroke="#ffffff"
                  strokeWidth={2}
                  ifOverflow="extendDomain"
                  label={renderBuyFlag}
                />

                {stopLoss && (
                  <ReferenceLine y={stopLoss} stroke="#ef4444" strokeWidth={1.5}
                    label={{ value: `SL: $${formatFullPrice(stopLoss)}`, fill: '#f87171', fontSize: 10, position: 'insideBottomLeft' }} />
                )}
                {effectiveTP && (
                  <ReferenceLine y={effectiveTP} stroke="#10b981" strokeWidth={1.5}
                    label={{ value: `TP: $${formatFullPrice(effectiveTP)}`, fill: '#34d399', fontSize: 10, position: 'insideTopRight' }} />
                )}
                {breakEvenPrice && (
                  <ReferenceLine y={breakEvenPrice} stroke="#a855f7" strokeDasharray="2 2"
                    label={{ value: `BE: $${formatFullPrice(breakEvenPrice)}`, fill: '#c084fc', fontSize: 10, position: 'insideBottomRight' }} />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : (
          /* Fallback visual position tracker if candles could not be loaded */
          <div className="relative h-36 w-full flex flex-col justify-center px-4 py-2 bg-card/40 rounded-lg border border-border/30 space-y-3">
            {hasConfidence && (
              <div className="lpc-holo">
                <div className="lpc-holo__k">ביטחון כניסה</div>
                <div className="lpc-holo__v">{Math.round(confidence!)}%</div>
              </div>
            )}
            <div className="flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                <span className="text-muted-foreground">מעקב מחיר שוק לפוזיציה</span>
                <Badge className="bg-primary/20 text-primary border-primary/30 text-[11px] px-1.5 py-0">
                  נקנה: ${formatFullPrice(entryPrice)}
                </Badge>
              </div>
              <span className={isProfitable ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                {isProfitable ? 'רווח נוכחי: +' : 'הפסד נוכחי: '}{pnlPercent.toFixed(2)}%
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px] font-mono text-muted-foreground">
                <span className="text-rose-400">SL: ${formatFullPrice(stopLoss || entryPrice * (isLong ? 0.95 : 1.05))}</span>
                <span className="text-emerald-400 font-bold">כניסה: ${formatFullPrice(entryPrice)}</span>
                <span className="text-emerald-400">TP: ${formatFullPrice(effectiveTP || entryPrice * (isLong ? 1.05 : 0.95))}</span>
              </div>
              <div className="relative h-2 w-full bg-muted/40 rounded-full overflow-hidden">
                <div
                  className={`h-full ${isProfitable ? 'bg-emerald-500' : 'bg-rose-500'} transition-all duration-300`}
                  style={{ width: `${Math.min(100, Math.max(5, 50 + pnlPercent * 2))}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
                <span>מרחק מ-SL: -{slDistancePercent.toFixed(1)}%</span>
                <span>מרחק מ-TP: +{tpDistancePercent.toFixed(1)}%</span>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2 pt-2 border-t border-border/30 text-xs font-mono">
          <div className="flex items-center gap-1 text-muted-foreground">
            <Crosshair className="w-3.5 h-3.5 text-blue-400" />
            <span>כניסה: </span>
            <span className="text-foreground font-semibold">${formatFullPrice(entryPrice)}</span>
          </div>
          {stopLoss && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
              <span>SL: </span>
              <span className="text-rose-400 font-semibold">${formatFullPrice(stopLoss)}</span>
            </div>
          )}
          {effectiveTP && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <Target className="w-3.5 h-3.5 text-emerald-400" />
              <span>TP: </span>
              <span className="text-emerald-400 font-semibold">${formatFullPrice(effectiveTP)}</span>
            </div>
          )}
          {breakEvenPrice && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <DollarSign className="w-3.5 h-3.5 text-purple-400" />
              <span>BE: </span>
              <span className="text-purple-400 font-semibold">${formatFullPrice(breakEvenPrice)}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default LivePositionChart;
