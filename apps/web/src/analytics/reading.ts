const idleMs = 30_000;
const readMs = 2_000;
const maxSeconds = 86_400;

export type ReadingSnapshot = {
  activeSeconds: number;
  maxScroll: number;
  blocks: Record<string, number>;
};

const seconds = (ms: number) => Math.min(maxSeconds, Math.round(ms / 1000));

export class Reading {
  private activeMs = 0;
  private readonly blockMs = new Map<string, number>();
  private readonly inBand = new Set<string>();
  private readonly read = new Set<string>();
  private lastTick: number;
  private lastInput?: number;
  private visible = true;
  private maxScroll = 0;

  constructor(private readonly now: () => number) {
    this.lastTick = now();
  }

  input(): void {
    this.advance();
    this.lastInput = this.now();
  }

  scrolled(percent: number): void {
    this.maxScroll = Math.max(this.maxScroll, Math.min(100, Math.round(percent)));
  }

  setVisible(visible: boolean): void {
    this.advance();
    this.visible = visible;
  }

  enter(block: string): void {
    this.advance();
    this.inBand.add(block);
  }

  leave(block: string): void {
    this.advance();
    this.inBand.delete(block);
  }

  newlyRead(): boolean {
    this.advance();
    let found = false;
    for (const [block, ms] of this.blockMs) {
      if (ms >= readMs && !this.read.has(block)) {
        this.read.add(block);
        found = true;
      }
    }
    return found;
  }

  snapshot(): ReadingSnapshot {
    this.advance();
    return {
      activeSeconds: seconds(this.activeMs),
      maxScroll: this.maxScroll,
      blocks: Object.fromEntries([...this.blockMs].map(([block, ms]) => [block, seconds(ms)])),
    };
  }

  private advance(): void {
    const now = this.now();
    if (this.visible && this.lastInput !== undefined) {
      const counted = Math.max(0, Math.min(now, this.lastInput + idleMs) - this.lastTick);
      this.activeMs += counted;
      for (const block of this.inBand) {
        this.blockMs.set(block, (this.blockMs.get(block) ?? 0) + counted);
      }
    }
    this.lastTick = now;
  }
}
