import { useId } from "react";

export type ComparisonTone = "home" | "draw" | "away";

export interface ComparisonChartItem {
  label: string;
  shortLabel: string;
  value: number;
  suffix: string;
  tone: ComparisonTone;
}

interface ComparisonMomentumChartProps {
  items: readonly ComparisonChartItem[];
  className?: string;
}

const chartPointX = [44, 160, 276] as const;
const chartBottom = 112;
const chartTop = 34;

export function ComparisonMomentumChart({ items, className = "" }: ComparisonMomentumChartProps) {
  const reactId = useId().replace(/:/g, "");
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const maxValue = Math.max(1, ...items.map((item) => item.value));
  const leaders = total > 0 ? items.filter((item) => item.value === maxValue) : [];
  const singleLeader = leaders.length === 1 ? leaders[0] : null;
  const chartPoints = items.map((item, index) => ({
    ...item,
    x: chartPointX[index] ?? chartPointX[chartPointX.length - 1],
    y: chartBottom - (item.value / maxValue) * (chartBottom - chartTop),
    isLeader: total > 0 && item.value === maxValue
  }));
  const linePath = buildSmoothLine(chartPoints);
  const areaPath = `${linePath} L ${chartPoints[chartPoints.length - 1]?.x ?? chartPointX[2]} ${chartBottom} L ${chartPoints[0]?.x ?? chartPointX[0]} ${chartBottom} Z`;
  const headline = total === 0 ? "Veri bekleniyor" : singleLeader ? `${singleLeader.label} önde` : "Mukayese dengede";
  const insight = total === 0 ? "Geçmiş maç geldikçe çizgi netleşir" : singleLeader ? `${singleLeader.value}${singleLeader.suffix} ile en yüksek sonuç` : `${maxValue} sonuçla ortak zirve`;
  const ariaLabel = `Mukayese grafiği: ${items.map((item) => `${item.label} ${item.value}${item.suffix}`).join(", ")}. ${total} maç.`;
  const cardClassName = ["comparisonGraphCard", "comparisonLineChart", className].filter(Boolean).join(" ");

  return (
    <section className={cardClassName} aria-label={ariaLabel}>
      <div className="comparisonLineHeader">
        <div>
          <span>Mukayese momentumu</span>
          <strong title={headline}>{headline}</strong>
        </div>
        <b>{total > 0 ? `${total} maç` : "Veri yok"}</b>
      </div>

      <div className="comparisonStats">
        {items.map((item) => {
          const isLeader = total > 0 && item.value === maxValue;
          return (
            <div className={`comparisonStat ${item.tone}${isLeader ? " isLeader" : ""}`} key={item.tone}>
              <span title={item.label}>{item.label}</span>
              <strong>
                {item.value}
                {item.suffix}
              </strong>
            </div>
          );
        })}
      </div>

      <div className="comparisonLineCanvas" aria-hidden="true">
        <svg viewBox="0 0 320 140" preserveAspectRatio="none" focusable="false">
          <defs>
            <linearGradient id={`${reactId}-comparison-line`} x1="44" x2="276" y1="0" y2="0" gradientUnits="userSpaceOnUse">
              <stop offset="0%" className="comparisonStopHome" />
              <stop offset="50%" className="comparisonStopDraw" />
              <stop offset="100%" className="comparisonStopAway" />
            </linearGradient>
            <linearGradient id={`${reactId}-comparison-area`} x1="0" x2="0" y1="28" y2="118" gradientUnits="userSpaceOnUse">
              <stop offset="0%" className="comparisonAreaStopTop" />
              <stop offset="100%" className="comparisonAreaStopBottom" />
            </linearGradient>
          </defs>
          {[34, 73, 112].map((y) => (
            <line className="comparisonGridLine" x1="24" x2="296" y1={y} y2={y} key={y} />
          ))}
          <path className="comparisonArea" d={areaPath} fill={`url(#${reactId}-comparison-area)`} />
          <path className="comparisonLine" d={linePath} stroke={`url(#${reactId}-comparison-line)`} />
          {chartPoints.map((point) => (
            <g className={`comparisonPointGroup ${point.tone}${point.isLeader ? " isLeader" : ""}`} key={point.tone}>
              <circle className="comparisonPointHalo" cx={point.x} cy={point.y} r={point.isLeader ? 13 : 10} />
              <circle className="comparisonPoint" cx={point.x} cy={point.y} r={point.isLeader ? 5.2 : 4.4} />
            </g>
          ))}
        </svg>
      </div>

      <div className="comparisonAxis">
        {items.map((item) => (
          <span className={item.tone} key={item.tone}>
            <i />
            <b>{item.shortLabel}</b>
            <em>
              {item.value}
              {item.suffix}
            </em>
          </span>
        ))}
      </div>

      <p className="comparisonLineInsight">{insight}</p>
    </section>
  );
}

function buildSmoothLine(points: { x: number; y: number }[]) {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  const [first, second, third] = points;
  if (!third) {
    return `M ${first.x} ${first.y} L ${second.x} ${second.y}`;
  }

  const firstControlX = first.x + (second.x - first.x) * 0.48;
  const secondControlX = second.x - (second.x - first.x) * 0.48;
  const thirdControlX = second.x + (third.x - second.x) * 0.48;
  const fourthControlX = third.x - (third.x - second.x) * 0.48;

  return [
    `M ${first.x} ${first.y}`,
    `C ${firstControlX} ${first.y}, ${secondControlX} ${second.y}, ${second.x} ${second.y}`,
    `C ${thirdControlX} ${second.y}, ${fourthControlX} ${third.y}, ${third.x} ${third.y}`
  ].join(" ");
}
