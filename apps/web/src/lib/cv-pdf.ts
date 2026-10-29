import PDFDocument from 'pdfkit';
import type { Content, Role } from '@portfolio/content';
import { fontPath } from './fonts';
import { formatPeriod, languagesLine, linkText, roleKindLabel, rolePlace } from './format';
import { palette } from './palette';
import { siteUrl } from './site';

const { fg: ink, accent, line } = palette.light;
const muted = '#57524a';
const margin = 40;
function options(extra: PDFKit.Mixins.TextLayout = {}) {
  return { link: null, ...extra, features: { liga: false } };
}

function roleLine(role: Role): string {
  return role.company ? `${role.role}, ${role.company}` : role.role;
}

function roleMeta(role: Role): string {
  return [formatPeriod(role), rolePlace(role), roleKindLabel(role.kind)]
    .filter(Boolean)
    .join('  ·  ');
}

export function buildCvPdf(content: Content): Promise<Buffer> {
  const { profile, cv, projects } = content;
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: margin, bottom: margin, left: margin, right: margin },
    info: {
      Title: `${profile.name} CV`,
      Author: profile.name,
      Subject: profile.headline,
      Keywords: [...profile.alternateNames, ...cv.skills.flatMap((skill) => skill.items)].join(
        ', ',
      ),
    },
  });
  doc.registerFont('regular', fontPath(400));
  doc.registerFont('semibold', fontPath(600));
  doc.registerFont('heavy', fontPath(800));

  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) =>
    doc.on('end', () => resolve(Buffer.concat(chunks))),
  );

  const width = doc.page.width - margin * 2;

  const heading = (text: string) => {
    doc.moveDown(0.9);
    doc.font('semibold').fontSize(10).fillColor(muted).text(text.toUpperCase(), options());
    const y = doc.y + 2;
    doc
      .moveTo(margin, y)
      .lineTo(margin + width, y)
      .lineWidth(0.6)
      .strokeColor(line)
      .stroke();
    doc.moveDown(0.6);
  };

  const heightOf = (
    text: string,
    font: string,
    size: number,
    layout: PDFKit.Mixins.TextLayout = {},
  ) => doc.font(font).fontSize(size).heightOfString(text, options(layout));

  const keepTogether = (height: number) => {
    if (doc.y + height > doc.page.maxY()) {
      doc.addPage();
    }
  };

  const bulletLayout = { indent: 0, paragraphGap: 2 };
  const bullet = (item: string) => `•  ${item}`;

  const bullets = (items: string[]) => {
    for (const item of items) {
      keepTogether(heightOf(bullet(item), 'regular', 10, bulletLayout));
      doc.font('regular').fontSize(10).fillColor(ink).text(bullet(item), options(bulletLayout));
    }
  };

  const roleBlock = (role: Role) => {
    keepTogether(
      heightOf(roleLine(role), 'semibold', 11.5) +
        heightOf(roleMeta(role), 'regular', 9.5) +
        (role.about ? heightOf(role.about, 'regular', 9.5, { paragraphGap: 3 }) : 0) +
        heightOf(bullet(role.highlights[0] ?? ''), 'regular', 10, bulletLayout),
    );
    doc.font('semibold').fontSize(11.5).fillColor(ink).text(roleLine(role), options());
    doc.font('regular').fontSize(9.5).fillColor(muted).text(roleMeta(role), options());
    if (role.about) {
      doc
        .font('regular')
        .fontSize(9.5)
        .fillColor(muted)
        .text(role.about, options({ paragraphGap: 3 }));
    }
    bullets(role.highlights);
  };

  const linkRow = (links: { text: string; href: string }[], size: number, color: string) => {
    doc.font('regular').fontSize(size);
    links.forEach(({ text, href }, index) => {
      const last = index === links.length - 1;
      doc.fillColor(color).text(text, options({ link: href, continued: !last }));
      if (!last) {
        doc.fillColor(muted).text('  ·  ', options({ continued: true }));
      }
    });
  };

  doc.font('heavy').fontSize(26).fillColor(ink).text(profile.name, options());
  doc.font('semibold').fontSize(13).fillColor(accent).text(profile.headline, options());
  doc.moveDown(0.3);
  doc
    .font('regular')
    .fontSize(10)
    .fillColor(muted)
    .text(`${profile.location} (${profile.timezone})  ·  ${profile.availability}`, options());
  linkRow(
    [
      { text: profile.links.email, href: `mailto:${profile.links.email}` },
      ...[siteUrl, profile.links.github, profile.links.linkedin].map((url) => ({
        text: linkText(url),
        href: url,
      })),
    ],
    10,
    ink,
  );

  heading('Summary');
  doc
    .font('regular')
    .fontSize(10.5)
    .fillColor(ink)
    .text(profile.summary, options({ lineGap: 2 }));

  heading('Experience');
  cv.experience.forEach((role, index) => {
    if (index > 0) {
      doc.moveDown(0.7);
    }
    roleBlock(role);
  });

  if (cv.mentoring.length > 0) {
    heading('Mentoring');
    cv.mentoring.forEach((role) => {
      roleBlock(role);
    });
  }

  heading('Projects');
  projects
    .filter((project) => project.caseStudy)
    .forEach((project, index) => {
      if (index > 0) {
        doc.moveDown(0.4);
      }
      doc
        .font('semibold')
        .fontSize(11)
        .fillColor(ink)
        .text(
          project.name,
          options({ link: `${siteUrl}/projects/${project.slug}`, continued: true }),
        )
        .font('regular')
        .fillColor(muted)
        .text(`  ${project.hook}`, options());
      doc.font('regular').fontSize(10).fillColor(ink).text(project.headline.text, options());
      linkRow(
        [project.links.live, project.links.repo]
          .filter((url) => url !== undefined)
          .map((url) => ({ text: linkText(url), href: url })),
        9.5,
        muted,
      );
    });

  heading('Skills');
  for (const skill of cv.skills) {
    doc
      .font('semibold')
      .fontSize(10)
      .fillColor(ink)
      .text(`${skill.group}: `, options({ continued: true }))
      .font('regular')
      .text(skill.items.join(', '), options());
  }

  heading('Languages');
  doc.font('regular').fontSize(10).fillColor(ink).text(languagesLine(cv.languages), options());

  doc.end();
  return done;
}
