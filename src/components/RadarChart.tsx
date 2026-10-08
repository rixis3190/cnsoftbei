import React, { useMemo } from 'react';

/* ------------------------------------------------------------------ */
/*  类型                                                               */
/* ------------------------------------------------------------------ */

export interface RadarDataItem {
  dimension: string;
  score: number;      // 0-100
  color: string;
  fullScore?: number; // 默认 100
}

interface RadarChartProps {
  data: RadarDataItem[];
  height?: number;
  accentColor?: string;
}

/* ------------------------------------------------------------------ */
/*  几何                                                               */
/* ------------------------------------------------------------------ */

interface Pt { x: number; y: number }

function polygonVertices(cx: number, cy: number, r: number, sides: number): Pt[] {
  return Array.from({ length: sides }, (_, i) => {
    const a = (2 * Math.PI * i) / sides - Math.PI / 2;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  });
}

function ptsStr(pts: Pt[]) { return pts.map(p => `${p.x},${p.y}`).join(' '); }

/* ------------------------------------------------------------------ */
/*  组件                                                               */
/* ------------------------------------------------------------------ */

const RadarChart: React.FC<RadarChartProps> = ({
  data,
  height = 440,
  accentColor = '#5B6AF0',
}) => {
  const svg = useMemo(() => {
    const N = data.length;
    const SIZE = 440;
    const CX = SIZE / 2;  // 220
    const CY = SIZE / 2;
    const R = 150;        // 最外层多边形半径

    // 5 层背景网格
    const LEVELS = [0.2, 0.4, 0.6, 0.8, 1.0];
    const gridPolys = LEVELS.map(l => polygonVertices(CX, CY, R * l, N));

    // 最外层顶点
    const outerVerts = polygonVertices(CX, CY, R, N);

    // 维度标签（比最外层远 40px）
    const labelVerts = polygonVertices(CX, CY, R + 40, N);

    // 数据多边形
    const dataVerts = data.map((d, i) => {
      const a = (2 * Math.PI * i) / N - Math.PI / 2;
      const max = d.fullScore ?? 100;
      const pct = Math.max(0.02, Math.min(d.score / max, 1)); // ≥2% 避免缩成点
      return { x: CX + R * pct * Math.cos(a), y: CY + R * pct * Math.sin(a) };
    });

    const fillPath = dataVerts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + 'Z';

    return { SIZE, CX, CY, R, gridPolys, outerVerts, labelVerts, dataVerts, fillPath };
  }, [data]);

  if (!data || data.length < 3) {
    return (
      <div style={{
        height, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#bfbfbf', fontSize: 14, userSelect: 'none',
      }}>
        {data && data.length > 0 ? '至少需要 3 个维度' : '暂无数据'}
      </div>
    );
  }

  // 标签锚点策略
  function labelAnchor(v: Pt): { anchor: 'start' | 'middle' | 'end'; dy: number } {
    const dx = v.x - svg.CX;
    const dy = v.y - svg.CY;
    const eps = 6;
    if (Math.abs(dx) < eps) {
      return { anchor: 'middle', dy: dy < 0 ? -6 : 18 };
    }
    return {
      anchor: dx > 0 ? 'start' : 'end',
      dy: dy < -eps ? -4 : dy > eps ? 14 : 5,
    };
  }

  return (
    <div style={{ width: '100%', height }}>
      <svg viewBox={`0 0 ${svg.SIZE} ${svg.SIZE}`} width="100%" height="100%" style={{ overflow: 'visible' }}>
        <defs>
          {/* 数据填充渐变 */}
          <linearGradient id="rf" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={accentColor} stopOpacity={0.3} />
            <stop offset="100%" stopColor={accentColor} stopOpacity={0.05} />
          </linearGradient>
          {/* 发光滤镜 */}
          <filter id="g" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="2" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* ---- 背景网格 ---- */}
        {svg.gridPolys.map((pts, idx) => {
          const isOuter = idx === svg.gridPolys.length - 1;
          return (
            <polygon
              key={`g${idx}`}
              points={ptsStr(pts)}
              fill={idx % 2 === 1 ? 'rgba(245,245,252,0.6)' : 'none'}
              stroke={isOuter ? '#c5c7d0' : '#e2e4ea'}
              strokeWidth={isOuter ? 1.5 : 1}
              strokeDasharray={isOuter ? undefined : '5,4'}
            />
          );
        })}

        {/* ---- 轴线 ---- */}
        {svg.outerVerts.map((v, i) => (
          <line key={`ax${i}`} x1={svg.CX} y1={svg.CY} x2={v.x} y2={v.y} stroke="#e0e2e8" strokeWidth={1} />
        ))}

        {/* ---- 刻度标注（沿顶部轴线） ---- */}
        {[50, 100].map(val => {
          const r = svg.R * (val / 100);
          return (
            <text key={`s${val}`} x={svg.CX} y={svg.CY - r - 4} textAnchor="middle" fontSize={10} fill="#999">
              {val}
            </text>
          );
        })}

        {/* ---- 维度标签 ---- */}
        {svg.labelVerts.map((v, i) => {
          const la = labelAnchor(v);
          return (
            <text
              key={`l${i}`}
              x={v.x}
              y={v.y + la.dy}
              textAnchor={la.anchor}
              fontSize={13}
              fontWeight={600}
              fill="#333"
            >
              {data[i].dimension}
            </text>
          );
        })}

        {/* ---- 数据区域 ---- */}
        <path d={svg.fillPath} fill="url(#rf)" stroke="none" />
        <path d={svg.fillPath} fill="none" stroke={accentColor} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" opacity={0.85} />

        {/* ---- 数据顶点 ---- */}
        {svg.dataVerts.map((v, i) => (
          <g key={`d${i}`} filter="url(#g)">
            <circle cx={v.x} cy={v.y} r={7} fill="#fff" stroke={accentColor} strokeWidth={2.5} />
            <circle cx={v.x} cy={v.y} r={3} fill={accentColor} />
            <text x={v.x} y={v.y - 12} textAnchor="middle" fontSize={11} fontWeight={700} fill={accentColor}>
              {data[i].score}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
};

export default RadarChart;
