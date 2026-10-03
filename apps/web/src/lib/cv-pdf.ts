import PDFDocument from 'pdfkit';
import type { Content, Role } from '@portfolio/content';
import { fontPath } from './fonts';
import { formatPeriod, kindLabel } from './format';
import { siteUrl } from './site';

const ink = '#0f151c';
const muted = '#4b5563';
const accent = '#a55a07';
const margin = 50;
const noLigatures = { features: { liga: false } } as unknown as PDFKit.Mixins.TextOptions;

function options(extra: PDFKit.Mixins.TextOptions = {}): PDFKit.Mixins.TextOptions {
  return { ...noLigatures, ...extra };
}

function roleLine(role: Role): string {
  return role.company ? `${role.role}, ${role.company}` : role.role;
}

function roleMeta(role: Role): string {
  const label = kindLabel(role.kind);
  const place = role.remote ? `${role.location} (remote)` : role.location;
  return [formatPeriod(role), place, label].filter(Boolean).join('  ·  ');
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
      .strokeColor('#cfd6dd')
      .stroke();
    doc.moveDown(0.6);
  };

  const bullets = (items: string[]) => {
    for (const item of items) {
      doc
        .font('regular')
        .fontSize(10)
        .fillColor(ink)
        .text(`•  ${item}`, options({ indent: 0, paragraphGap: 2 }));
    }
  };

  doc.font('heavy').fontSize(26).fillColor(ink).text(profile.name, options());
  doc.font('semibold').fontSize(13).fillColor(accent).text(profile.headline, options());
  doc.moveDown(0.3);
  doc
    .font('regular')
    .fontSize(10)
    .fillColor(muted)
    .text(`${profile.location} (${profile.timezone})  ·  ${profile.availability}`, options());
  doc
    .fillColor(ink)
    .text(profile.links.email, options({ link: `mailto:${profile.links.email}`, continued: true }))
    .fillColor(muted)
    .text('  ·  ', options({ continued: true }))
    .fillColor(ink)
    .text(siteUrl.replace('https://', ''), options({ link: siteUrl, continued: true }))
    .fillColor(muted)
    .text('  ·  ', options({ continued: true }))
    .fillColor(ink)
    .text(
      profile.links.github.replace('https://', ''),
      options({ link: profile.links.github, continued: true }),
    )
    .fillColor(muted)
    .text('  ·  ', options({ continued: true }))
    .fillColor(ink)
    .text(
      profile.links.linkedin.replace('https://www.', ''),
      options({ link: profile.links.linkedin }),
    );

  heading('Summary');
  doc
    .font('regular')
    .fontSize(10.5)
    .fillColor(ink)
    .text(profile.summary, options({ lineGap: 2 }));

  heading('Experience');
  cv.experience.forEach((role, index) => {
    if (index > 0) doc.moveDown(0.7);
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
  });

  if (cv.mentoring.length > 0) {
    heading('Mentoring');
    cv.mentoring.forEach((role) => {
      doc.font('semibold').fontSize(11.5).fillColor(ink).text(roleLine(role), options());
      doc.font('regular').fontSize(9.5).fillColor(muted).text(roleMeta(role), options());
      bullets(role.highlights);
    });
  }

  heading('Projects');
  projects.forEach((project, index) => {
    if (index > 0) doc.moveDown(0.4);
    const href = project.caseStudy ? `${siteUrl}/projects/${project.slug}` : project.links.live;
    doc
      .font('semibold')
      .fontSize(11)
      .fillColor(ink)
      .text(project.name, options({ link: href, continued: true }))
      .font('regular')
      .fillColor(muted)
      .text(`  ${project.hook}`, options());
    doc.font('regular').fontSize(9.5).fillColor(muted).text(project.stack.join(', '), options());
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
  doc
    .font('regular')
    .fontSize(10)
    .fillColor(ink)
    .text(
      cv.languages
        .map((language) => `${language.name} (${language.level.toLowerCase()})`)
        .join(', '),
      options(),
    );

  doc.end();
  return done;
}
