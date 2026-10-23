import replay from './commission-data.json';

export const commissionReplay = replay;

export const commissionParameters = {
  speed: 6,
  holdSeconds: 4,
};

export const families = ['I', 'II', 'III', 'IV', 'V'];

export type Seat = 'up' | 'down' | 'frozen' | 'out';
export type LinkState = 'open' | 'slow' | 'one-way' | 'cut';
export type Heartbeat = 'answered' | 'unanswered' | 'lost' | 'none';

type Link = { from: number; to: number };

type Fault = {
  start: number;
  end: number;
  kind: string;
  nodes: number[];
  groups: number[][];
  netem: { delay: number; jitter: number; loss: number } | null;
};

type Effect = {
  down: number[];
  frozen: number[];
  out: number[];
  slow: number[];
  blocked: Link[];
  text: string;
};

const parameters = commissionParameters;
const replayEnd = replay.seconds / parameters.speed;
export const commissionLoop = replayEnd + parameters.holdSeconds;

const everyone = families.map((_, index) => index + 1);

export function numeral(node: number): string {
  return families[node - 1] ?? String(node);
}

function names(nodes: number[]): string {
  return [...nodes]
    .sort((a, b) => a - b)
    .map(numeral)
    .join(' ');
}

function across(a: number[], b: number[]): Link[] {
  return a.flatMap((x) =>
    b.flatMap((y) => [
      { from: x, to: y },
      { from: y, to: x },
    ]),
  );
}

function leaderAt(at: number): number {
  return replay.leaders.filter((entry) => entry.at <= at).at(-1)?.node ?? 0;
}

function effectOf(fault: Fault): Effect {
  const none = { down: [], frozen: [], out: [], slow: [], blocked: [] };
  const [first = 0, second = 0] = fault.nodes;
  const [left = [], right = []] = fault.groups;
  switch (fault.kind) {
    case 'kill':
    case 'kill-leader': {
      const don = first === leaderAt(fault.start) ? ', the Don' : '';
      return { ...none, down: [first], text: `SIGKILL family ${numeral(first)}${don}` };
    }
    case 'pause':
      return { ...none, frozen: [first], text: `family ${numeral(first)} frozen` };
    case 'isolate':
      return {
        ...none,
        blocked: across(
          [first],
          everyone.filter((node) => node !== first),
        ),
        text: `family ${numeral(first)} cut off from the rest`,
      };
    case 'split':
      return {
        ...none,
        blocked: across(left, right),
        text: `split ${names(left)} | ${names(right)}`,
      };
    case 'bridge':
      return {
        ...none,
        blocked: across(left, right),
        text: `${names(left)} | ${names(right)}, bridged by ${numeral(first)}`,
      };
    case 'one-way':
      return {
        ...none,
        blocked: [{ from: first, to: second }],
        text: `${numeral(first)} can't reach ${numeral(second)}, ${numeral(second)} still reaches ${numeral(first)}`,
      };
    case 'netem': {
      const network = fault.netem
        ? `${fault.netem.delay} ± ${fault.netem.jitter} ms, ${fault.netem.loss}% loss`
        : 'a slow network';
      return {
        ...none,
        slow: [first],
        text: `family ${numeral(first)} on a bad network: ${network}`,
      };
    }
    case 'member':
      return {
        ...none,
        out: [first],
        text: `family ${numeral(first)} removed, then back as a learner and promoted`,
      };
    case 'transfer':
      return { ...none, text: `the Don hands over from ${numeral(first)} to ${numeral(second)}` };
    default:
      throw new Error(`no effect for a ${fault.kind} fault`);
  }
}

const faults: Fault[] = replay.faults;
const timeline = faults.map((fault) => ({ ...fault, ...effectOf(fault) }));

function seatOf(node: number, active: Effect[]): Seat {
  if (active.some((fault) => fault.down.includes(node))) {
    return 'down';
  }
  if (active.some((fault) => fault.frozen.includes(node))) {
    return 'frozen';
  }
  return active.some((fault) => fault.out.includes(node)) ? 'out' : 'up';
}

export function commissionAt(seconds: number) {
  const at = Math.min(replay.seconds, seconds * parameters.speed);
  const active = timeline.filter((fault) => fault.start <= at && at < fault.end);
  const seats = new Map(everyone.map((node) => [node, seatOf(node, active)]));
  const seat = (node: number): Seat => seats.get(node) ?? 'up';
  const blocked = active.flatMap((fault) => fault.blocked);
  const slow = active.flatMap((fault) => fault.slow);
  const reaches = (from: number, to: number) =>
    !blocked.some((link) => link.from === from && link.to === to);
  const gone = (node: number) => seat(node) === 'down' || seat(node) === 'out';
  const elected = replay.leaders.filter((entry) => entry.at <= at);
  const current = elected.at(-1);
  const leader = current?.node ?? 0;
  const don = seat(leader) === 'down' ? 0 : leader;
  const speaker = don > 0 && seat(don) === 'up' ? don : 0;
  return {
    at,
    finished: seconds >= replayEnd,
    don,
    speaker,
    term: current?.term ?? 0,
    seat,
    slow: (node: number) => slow.includes(node),
    link(a: number, b: number): LinkState {
      const ab = reaches(a, b);
      const ba = reaches(b, a);
      if (gone(a) || gone(b) || (!ab && !ba)) {
        return 'cut';
      }
      if (!ab || !ba) {
        return 'one-way';
      }
      return slow.includes(a) || slow.includes(b) ? 'slow' : 'open';
    },
    heartbeat(node: number): Heartbeat {
      if (speaker === 0 || node === speaker || seat(node) === 'out') {
        return 'none';
      }
      if (seat(node) === 'down' || !reaches(speaker, node)) {
        return 'lost';
      }
      return seat(node) === 'up' && reaches(node, speaker) ? 'answered' : 'unanswered';
    },
    fault: active.at(-1) ?? null,
    faultsSoFar: timeline.filter((fault) => fault.start <= at).length,
    successions: Math.max(0, elected.filter((entry) => entry.node > 0).length - 1),
  };
}

export type Commission = ReturnType<typeof commissionAt>;
