import { type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { KenBurnsPhoto } from "./KenBurnsPhoto";
import { KineticText } from "./KineticText";
import { CanvasStickerLayer } from "./CanvasStickerLayer";
import {
  type CanvasSpec,
  DEFAULT_CANVAS,
  GRADIENTS,
  SAFE_CANVAS_BACKGROUND,
  getStableCanvasNumber,
} from "@/lib/canvas";

type KineticCanvasProps = {
  spec: CanvasSpec;
  photo?: string | null;
  paused?: boolean;
  /** Bump to replay the entrance/loop animations (e.g. on each new question). */
  playKey?: number;
  className?: string;
  /** Overlay UI (e.g. answer choices) rendered above the kinetic text. */
  children?: ReactNode;
};

/**
 * One embedded version of KineMedia's kinetic canvas: an animated gradient or
 * Ken Burns photo backdrop carrying kinetic typography, with optional UI layered
 * on top. Intentionally trimmed — no slideshow/video/sticker-editing — so it can
 * drop into the guest quiz experience as an immersive stage.
 */
export function KineticCanvas({
  spec,
  photo,
  paused = false,
  playKey = 0,
  className,
  children,
}: KineticCanvasProps) {
  const reducedMotion = useReducedMotion();
  const gradient = spec.gradientPath && spec.gradientPath.length > 0 ? spec.gradientPath[0] : null;
  const background = gradient ?? SAFE_CANVAS_BACKGROUND;
  const drift = !reducedMotion && !paused;

  return (
    <div
      className={`relative h-full w-full overflow-hidden bg-black ${className ?? ""}`}
    >
      {photo ? (
        <KenBurnsPhoto src={photo} seed={spec.text} paused={paused} fallbackBackground={background} />
      ) : (
        <motion.div
          aria-hidden
          className="absolute inset-[-15%]"
          style={{
            background: SAFE_CANVAS_BACKGROUND,
            backgroundImage: background,
            backgroundSize: "220% 220%",
            backgroundPosition: "50% 50%",
          }}
          animate={
            drift
              ? { backgroundPosition: ["0% 0%", "100% 100%", "0% 0%"], scale: [1, 1.08, 1] }
              : undefined
          }
          transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
        />
      )}

      {/* Readability scrim — keeps the question and answer UI legible on any backdrop. */}
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_28%,rgba(0,0,0,0.42)_100%)]"
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/10 to-black/70"
      />

      <KineticText spec={spec} playKey={playKey} paused={paused} scaleToCanvas background={background} />

      {spec.stickers && spec.stickers.length > 0 && (
        <CanvasStickerLayer stickers={spec.stickers} text={spec.text} layout={spec} playKey={playKey} />
      )}

      {children && <div className="pointer-events-none absolute inset-0 z-20">{children}</div>}
    </div>
  );
}

/** Deterministically pick a vivid gradient for a quiz so each quiz keeps one theme. */
export function quizThemeGradient(seed: string): string {
  return GRADIENTS[getStableCanvasNumber(seed) % GRADIENTS.length];
}

/** Derive a kinetic-canvas spec from a quiz question so it renders as immersive type. */
export function buildQuizCanvasSpec(
  questionText: string | undefined,
  themeGradient: string,
  category?: string,
): CanvasSpec {
  const text = questionText ?? "";
  const words = text.split(/\s+/).filter(Boolean).length;
  const size = words > 14 ? 44 : words > 8 ? 52 : words > 5 ? 60 : 68;
  return {
    ...DEFAULT_CANVAS,
    text: questionText,
    font: "Space Grotesk",
    size,
    color: "#ffffff",
    weight: 700,
    letterSpacing: -0.02,
    x: 50,
    // Lift the headline above the answer tray pinned to the bottom.
    y: 36,
    entrance: "slide",
    loop: "none",
    tempo: "steady",
    rhythm: "stagger",
    rotation: 0,
    stickers: category
      ? [{ id: "cat", kind: "emoji", word: category, emoji: categoryEmoji(category), x: 50, y: 14, size: 12 }]
      : [],
    backgroundStyle: "static",
    gradientPath: [themeGradient],
  };
}

function categoryEmoji(category?: string): string {
  const map: Record<string, string> = {
    leisure: "🎉",
    food: "🍔",
    entertainment: "🎬",
    travel: "✈️",
    social: "💬",
    habits: "🌱",
    spending: "💸",
    emotion: "💗",
    home: "🏡",
    growth: "🌟",
    values: "💎",
  };
  const key = (category ?? "").toLowerCase();
  return map[key] ?? "💡";
}
