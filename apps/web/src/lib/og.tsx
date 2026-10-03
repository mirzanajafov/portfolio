import { ImageResponse } from 'next/og';
import { loadFont } from './fonts';

export const ogSize = { width: 1200, height: 630 };

const colours = {
  bg: '#0a0d11',
  fg: '#e9edf1',
  muted: '#8a96a3',
  accent: '#f2a33a',
  line: '#232c36',
};

export type Card = {
  eyebrow: string;
  title: string;
  subtitle: string;
  footer: string;
};

export async function renderCard(card: Card): Promise<ImageResponse> {
  const [regular, semibold, heavy] = await Promise.all([
    loadFont(400),
    loadFont(600),
    loadFont(800),
  ]);
  const titleSize = card.title.length > 14 ? 104 : 136;

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '64px 72px',
        backgroundColor: colours.bg,
        backgroundImage: `radial-gradient(circle at 82% 18%, rgba(242,163,58,0.22), rgba(10,13,17,0) 48%), linear-gradient(${colours.line} 1px, transparent 1px), linear-gradient(90deg, ${colours.line} 1px, transparent 1px)`,
        backgroundSize: '100% 100%, 72px 72px, 72px 72px',
        color: colours.fg,
        fontFamily: 'Schibsted Grotesk',
      }}
    >
      <div
        style={{
          display: 'flex',
          fontSize: 26,
          fontWeight: 400,
          letterSpacing: 2,
          textTransform: 'uppercase',
          color: colours.muted,
        }}
      >
        {card.eyebrow}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div
          style={{
            display: 'flex',
            fontSize: titleSize,
            fontWeight: 800,
            lineHeight: 0.9,
            letterSpacing: -5,
          }}
        >
          {card.title}
        </div>
        <div style={{ display: 'flex', fontSize: 44, fontWeight: 600, color: colours.accent }}>
          {card.subtitle}
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          fontSize: 26,
          color: colours.muted,
        }}
      >
        <div style={{ display: 'flex', maxWidth: 820 }}>{card.footer}</div>
        <div style={{ display: 'flex', color: colours.fg, fontWeight: 600 }}>najafov.dev</div>
      </div>
    </div>,
    {
      ...ogSize,
      fonts: [
        { name: 'Schibsted Grotesk', data: regular, weight: 400, style: 'normal' },
        { name: 'Schibsted Grotesk', data: semibold, weight: 600, style: 'normal' },
        { name: 'Schibsted Grotesk', data: heavy, weight: 800, style: 'normal' },
      ],
    },
  );
}

export function truncate(text: string, length: number): string {
  if (text.length <= length) {
    return text;
  }
  const cut = text.slice(0, length);
  return `${cut.slice(0, cut.lastIndexOf(' '))}…`;
}
