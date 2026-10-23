import data from './commission-data.json';

export const commissionData = data;

export const commissionParameters = {
  speed: 6,
  holdSeconds: 4,
};

export const families = ['I', 'II', 'III', 'IV', 'V'];

type Fault = {
  start: number;
  end: number;
  kind: string;
  text: string;
  down: number[];
  frozen: number[];
  out: number[];
  slow: number[];
  blocked: { from: number; to: number }[];
};
export type Seat = 'up' | 'down' | 'frozen' | 'out';

const faults: Fault[] = data.faults;

const p = commissionParameters;
const replayEnd = data.seconds / p.speed;
export const commissionLoop = replayEnd + p.holdSeconds;

export function numeral(node: number): string {
  return families[node - 1] ?? String(node);
}

export function commissionAt(seconds: number) {
  const at = Math.min(data.seconds, seconds * p.speed);
  const active = faults.filter((fault) => fault.start <= at && at < fault.end);
  const seated = (node: number): Seat => {
    if (active.some((fault) => fault.down.includes(node))) {
      return 'down';
    }
    if (active.some((fault) => fault.frozen.includes(node))) {
      return 'frozen';
    }
    return active.some((fault) => fault.out.includes(node)) ? 'out' : 'up';
  };
  const elected = data.leaders.filter((entry) => entry.at <= at);
  const current = elected.at(-1);
  return {
    at,
    finished: seconds >= replayEnd,
    don: current?.node ?? 0,
    term: current?.term ?? 0,
    seat: seated,
    slow: active.flatMap((fault) => fault.slow),
    blocked: active.flatMap((fault) => fault.blocked),
    fault: active.at(-1) ?? null,
    faults: faults.filter((fault) => fault.start <= at).length,
    successions: Math.max(0, elected.filter((entry) => entry.node > 0).length - 1),
  };
}

export type Commission = ReturnType<typeof commissionAt>;

export function reaches(state: Commission, from: number, to: number): boolean {
  return !state.blocked.some((link) => link.from === from && link.to === to);
}
