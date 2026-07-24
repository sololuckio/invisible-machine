"use client";

import { useId } from "react";

/**
 * An accessible control dial: native range input (keyboard, screen reader
 * and touch for free) styled as part of the machine console.
 */
export function Slider({
  label,
  value,
  onChange,
  hint,
  min = 0,
  max = 100,
  disabled = false,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  hint?: string;
  min?: number;
  max?: number;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="slider-row">
      <div className="slider-head">
        <label htmlFor={id}>{label}</label>
        <output htmlFor={id} className="slider-value">
          {Math.round(value)}%
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={1}
        value={Math.round(value)}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-describedby={hint ? `${id}-hint` : undefined}
        style={{ "--fill": `${((value - min) / (max - min)) * 100}%` } as React.CSSProperties}
      />
      {hint && (
        <p id={`${id}-hint`} className="slider-hint">
          {hint}
        </p>
      )}
    </div>
  );
}
