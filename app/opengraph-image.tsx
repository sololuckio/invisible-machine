import { ImageResponse } from "next/og";
import { SITE } from "@/data/site";

export const alt = SITE.title;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Generated social preview: the machine's schematic identity, no assets. */
export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "#08090b",
        padding: "64px 72px",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div
          style={{
            color: "#9ba1a6",
            fontSize: 22,
            letterSpacing: 6,
          }}
        >
          TIM-01 · LIVE SYSTEM SIMULATION
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {["#6ee7ff", "#ffb454", "#ff5d5d"].map((c) => (
            <div key={c} style={{ width: 14, height: 14, background: c, borderRadius: 7 }} />
          ))}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        <div
          style={{
            color: "#e8eaed",
            fontSize: 92,
            fontWeight: 700,
            letterSpacing: -3,
            lineHeight: 1.02,
          }}
        >
          The Invisible
        </div>
        <div
          style={{
            color: "#6ee7ff",
            fontSize: 92,
            fontWeight: 700,
            letterSpacing: -3,
            lineHeight: 1.02,
          }}
        >
          Machine
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} style={{ display: "flex", alignItems: "center" }}>
              <div
                style={{
                  width: 26,
                  height: 26,
                  border: `3px solid ${i === 4 ? "#ffb454" : "#6ee7ff"}`,
                  background: i === 4 ? "rgba(255,180,84,0.2)" : "rgba(110,231,255,0.12)",
                  transform: "rotate(45deg)",
                }}
              />
              {i < 7 && (
                <div
                  style={{
                    width: 84,
                    height: 3,
                    marginLeft: 14,
                    background: "#252a31",
                  }}
                />
              )}
            </div>
          ))}
        </div>
        <div style={{ color: "#9ba1a6", fontSize: 28 }}>
          Every business is a living system. Watch one break — then teach it to fix itself.
        </div>
      </div>
    </div>,
    { ...size },
  );
}
