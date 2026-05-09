"use client";

import { useMemo } from "react";

import { SKILL_AXES, radarAxisPoint, skillValue } from "../helpers";
import type { CareerRpgLabels } from "../i18n";
import type { UserCareerState } from "../types";

interface Props {
  state: UserCareerState;
  axisLabels: CareerRpgLabels["career"]["skillsAxisLabels"];
  size?: number;
}

const RADIUS = 110;
const RING_STEPS = [25, 50, 75, 100];

export function CareerSkillRadar({ state, axisLabels, size = 280 }: Props) {
  const center = size / 2;

  const polygon = useMemo(() => {
    return SKILL_AXES.map((axis, idx) => {
      const v = skillValue(state, axis) / 100;
      const { x, y } = radarAxisPoint(idx, SKILL_AXES.length, RADIUS * v);
      return `${center + x},${center + y}`;
    }).join(" ");
  }, [state, center]);

  return (
    <div className="flex flex-col items-center gap-3">
      <svg
        aria-hidden
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <radialGradient cx="50%" cy="50%" id="rpg-radar-fill" r="50%">
            <stop offset="0%" stopColor="#1B2A4A" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#1B2A4A" stopOpacity="0.32" />
          </radialGradient>
        </defs>
        {RING_STEPS.map((pct) => (
          <polygon
            fill="none"
            key={pct}
            points={SKILL_AXES.map((_, idx) => {
              const { x, y } = radarAxisPoint(idx, SKILL_AXES.length, RADIUS * (pct / 100));
              return `${center + x},${center + y}`;
            }).join(" ")}
            stroke="#E2E8F0"
            strokeWidth={1}
          />
        ))}
        {SKILL_AXES.map((_, idx) => {
          const { x, y } = radarAxisPoint(idx, SKILL_AXES.length, RADIUS);
          return (
            <line
              key={idx}
              stroke="#E2E8F0"
              strokeWidth={1}
              x1={center}
              x2={center + x}
              y1={center}
              y2={center + y}
            />
          );
        })}
        <polygon fill="url(#rpg-radar-fill)" points={polygon} stroke="#1B2A4A" strokeWidth={2} />
        {SKILL_AXES.map((axis, idx) => {
          const { x, y } = radarAxisPoint(idx, SKILL_AXES.length, RADIUS + 22);
          return (
            <text
              fill="#111827"
              fontSize="11"
              fontWeight={600}
              key={axis}
              textAnchor={idx === 0 ? "middle" : x > 0 ? "start" : "end"}
              x={center + x}
              y={center + y + 4}
            >
              {axisLabels[axis]}
            </text>
          );
        })}
        {SKILL_AXES.map((axis, idx) => {
          const v = skillValue(state, axis);
          const { x, y } = radarAxisPoint(idx, SKILL_AXES.length, RADIUS * (v / 100));
          return (
            <circle
              cx={center + x}
              cy={center + y}
              fill="#1B2A4A"
              key={`dot-${axis}`}
              r={3.5}
              stroke="#FFFFFF"
              strokeWidth={1.5}
            />
          );
        })}
      </svg>
      <ul className="grid w-full grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-3">
        {SKILL_AXES.map((axis) => (
          <li className="flex items-center justify-between text-[#4B5563]" key={axis}>
            <span>{axisLabels[axis]}</span>
            <span className="font-semibold text-[#111827]">{skillValue(state, axis)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
