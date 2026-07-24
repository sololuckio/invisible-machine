import type { SVGProps } from "react";

/** Minimal 16×16 stroke icons, drawn for this interface — no icon library. */

function base(props: SVGProps<SVGSVGElement>) {
  return {
    width: 16,
    height: 16,
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.4,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    ...props,
  };
}

export function IconSoundOn(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M2 6.5v3h2.5L8 12V4L4.5 6.5H2z" />
      <path d="M10.5 5.5a3.2 3.2 0 0 1 0 5" />
      <path d="M12.5 3.8a6 6 0 0 1 0 8.4" />
    </svg>
  );
}

export function IconSoundOff(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M2 6.5v3h2.5L8 12V4L4.5 6.5H2z" />
      <path d="M10.5 6l4 4M14.5 6l-4 4" />
    </svg>
  );
}

export function IconGear(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <circle cx="8" cy="8" r="2.2" />
      <path d="M8 1.8v2M8 12.2v2M1.8 8h2M12.2 8h2M3.6 3.6l1.4 1.4M11 11l1.4 1.4M12.4 3.6L11 5M5 11l-1.4 1.4" />
    </svg>
  );
}

export function IconClose(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
    </svg>
  );
}

export function IconPlay(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M5 3.5v9l7-4.5-7-4.5z" />
    </svg>
  );
}

export function IconPause(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M5.5 3.5v9M10.5 3.5v9" />
    </svg>
  );
}

export function IconReset(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M2.5 8a5.5 5.5 0 1 0 1.6-3.9" />
      <path d="M4 1.5v3h3" />
    </svg>
  );
}

export function IconArrowDown(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M8 2.5v11M3.5 9l4.5 4.5L12.5 9" />
    </svg>
  );
}

export function IconArrowUpRight(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M4 12L12 4M6 4h6v6" />
    </svg>
  );
}

export function IconPulse(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M1.5 8h3l1.5-4 3 8 1.5-4h4" />
    </svg>
  );
}
