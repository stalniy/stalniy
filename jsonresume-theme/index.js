const fs = require('node:fs');
const path = require('node:path');
const css = fs.readFileSync(path.join(__dirname, 'style.css'), 'utf8');

function escape(value = '') {
  return String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

function link(label, url) {
  if (!url) return escape(label);
  if (/^[\w.-]+\.[a-z]{2,}(?:\/|$)/i.test(url)) url = 'https://' + url;
  if (!/^(https?:\/\/|mailto:|tel:)/i.test(url)) return escape(label);
  return `<a href="${escape(url)}">${escape(label || url)}</a>`;
}

// Resume text supports bold emphasis, inline links, paragraphs and bullet lists.
function inline(value = '') {
  const tokens = String(value).split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^\s)]+\))/g);
  return tokens.map(token => {
    if (token.startsWith('**') && token.endsWith('**')) {
      return '<strong>' + escape(token.slice(2, -2)) + '</strong>';
    }
    const match = token.match(/^\[([^\]]+)\]\(([^\s)]+)\)$/);
    return match ? link(match[1], match[2]) : escape(token);
  }).join('');
}

function list(items, className = '') {
  const rows = items.filter(Boolean);
  return rows.length ? `<ul class="${className}">${rows.map(row => '<li>' + row + '</li>').join('')}</ul>` : '';
}

function prose(value = '') {
  return String(value).trim().split(/\n\s*\n/).filter(Boolean).map(block => {
    const lines = block.trim().split(/\r?\n/);
    if (lines.every(line => /^\s*[-*] /.test(line))) {
      return list(lines.map(line => inline(line.replace(/^\s*[-*] /, ''))));
    }
    return '<p>' + inline(lines.join(' ')) + '</p>';
  }).join('');
}

function section(title, content, className = '') {
  return content && `<section class="${className}"><h2>${title}</h2><div class="section-body">${content}</div></section>`;
}

function entry(title, metadata, content = '', focusTopics = [], filterKeywords, ownKeywords) {
  const details = metadata.filter(Boolean).map(value => `<span class="meta">${value}</span>`).join('');
  const focus = focusTopics.length ? `<p class="focus-topics">${focusTopics.map(escape).join(' · ')}</p>` : '';
  const filter = filterKeywords ? ` data-filter-entry data-keywords="${escape(JSON.stringify(filterKeywords))}" data-own-keywords="${escape(JSON.stringify(ownKeywords || []))}"` : '';
  return `<article${filter}><h3>${title}${details}</h3>${focus}${content}</article>`;
}

function date(value = '') {
  const match = /^(\d{4})-(\d{2})(?:-\d{2})?$/.exec(value);
  return match ? match[2] + '.' + match[1] : escape(value);
}

function period(item) {
  return [date(item.startDate), date(item.endDate || (item.startDate ? 'Present' : ''))].filter(Boolean).join(' - ');
}

function place(location = {}) {
  if (typeof location === 'string') return location;
  let country = location.countryCode;
  if (/^[a-z]{2}$/i.test(country || '')) {
    country = new Intl.DisplayNames(['en'], { type: 'region' }).of(country.toUpperCase());
  }
  return [country, location.region, location.city].filter(Boolean).join(', ');
}

function header(basics) {
  const names = { github: 'GitHub', linkedin: 'LinkedIn' };
  const contacts = [
    escape(place(basics.location)),
    basics.email && link(basics.email, 'mailto:' + basics.email),
    basics.phone && link(basics.phone, 'tel:' + basics.phone),
    basics.url && link(basics.url, basics.url),
    ...(basics.profiles || []).map(p => link(names[p.network?.toLowerCase()] || p.network || p.username, p.url))
  ].filter(Boolean);
  return `<header><h1>${escape(basics.name)}</h1>
    ${basics.label ? '<p class="tagline">' + escape(basics.label) + '</p>' : ''}
    <div class="contacts">${contacts.map(text => '<span>' + text + '</span>').join('')}</div></header>`;
}

function skillRows(skills) {
  const groups = new Map();
  for (const skill of skills) {
    const group = skill.custom?.group || skill.name;
    if (!groups.has(group)) groups.set(group, []);
    const values = groups.get(group);
    if (skill.custom?.group) values.push(skill.name);
    values.push(...(skill.keywords || []));
  }
  const rows = [...groups].map(([name, values]) =>
    '<strong>' + escape(name) + (values.length ? ':</strong> ' : '</strong>') + values.map(escape).join(', '));
  return list(rows, 'skills');
}

function highlights(item, interactive = false) {
  const marked = new Set(item.custom?.focusHighlights);
  return list((item.highlights || []).map((line, index) => {
    const content = marked.has(index) ? '<mark>' + inline(line) + '</mark>' : inline(line);
    const keywords = item.custom?.filterHighlightKeywords?.[index];
    return interactive && keywords ? `<span data-highlight-keywords="${escape(JSON.stringify(keywords))}">${content}</span>` : content;
  }));
}

const filterScript = `<script>
(() => {
  const toolbar = document.querySelector('.keyword-toolbar');
  const buttons = [...toolbar.querySelectorAll('[data-keyword]')];
  const entries = [...document.querySelectorAll('[data-filter-entry]')];
  const selected = new Set();
  const matches = keywords => keywords.some(keyword => selected.has(keyword));
  const keywordsOf = element => JSON.parse(element.dataset.keywords || '[]');

  toolbar.addEventListener('click', event => {
    const button = event.target.closest('[data-keyword]');
    if (!button || !toolbar.contains(button)) return;
    const keyword = button.dataset.keyword;
    if (!keyword) selected.clear();
    else if (selected.has(keyword)) selected.delete(keyword);
    else selected.add(keyword);

    for (const chip of buttons) {
      chip.setAttribute('aria-pressed', String(chip.dataset.keyword ? selected.has(chip.dataset.keyword) : !selected.size));
    }
    for (const entry of entries) {
      const ownMatch = matches(JSON.parse(entry.dataset.ownKeywords));
      entry.hidden = selected.size > 0 && !matches(keywordsOf(entry));
      for (const highlight of entry.querySelectorAll('[data-highlight-keywords]')) {
        highlight.parentElement.hidden = !entry.hidden && selected.size > 0 && !ownMatch &&
          !matches(JSON.parse(highlight.dataset.highlightKeywords));
      }
    }
    for (const section of document.querySelectorAll('.filter-section')) {
      section.querySelector('.filter-empty').hidden = [...section.querySelectorAll('[data-filter-entry]')].some(entry => !entry.hidden);
    }
  });
})();
</script>`;

function toolbar(keywords) {
  const chips = keywords.map(([keyword, label]) =>
    `<button type="button" data-keyword="${escape(keyword)}" aria-pressed="false">${escape(String(label).replace(/-/g, ' '))}</button>`).join('');
  return `<nav class="keyword-toolbar" aria-label="Filter resume by keyword"><div class="toolbar-inner"><div class="keyword-list"><button type="button" data-keyword="" aria-pressed="true">All</button>${chips}</div></div></nav>`;
}

function scope(work, skillNames) {
  const summary = work.summary?.trim();
  const skills = (work.skills || []).slice(0, 10).map(skill => escape(skillNames.get(skill) || skill)).join(', ');
  if (!summary && !skills) return '';
  return '<div class="scope-row">' + (summary ? '<h5>Scope</h5>' : '') +
    (skills ? '<span class="work-skills">' + skills + '</span>' : '') + '</div>' + prose(summary);
}

function render(resume, { interactive = false, keywords = [] } = {}) {
  const { basics = {}, skills = [], languages = [], projects = [], work = [], education = [],
    certificates = [], interests = [], volunteer = [], awards = [], publications = [], references = [] } = resume;
  const skillNames = new Map(skills.filter(skill => skill.id).map(skill => [skill.id, skill.name]));
  skillNames.set('ts-js', 'TypeScript, Node.js')
  const sections = [
    section('Summary', prose(basics.summary), 'summary'),
    section('Experience', work.map(w => entry(
      link(w.position || w.name, w.url),
      [w.position && escape(w.name), escape(place(w.location)), period(w)],
      (w.description?.trim() ? '<div class="project-description">' + prose(w.description) + '</div>' : '') +
      scope(w, skillNames) +
      (w.highlights?.some(Boolean) ? '<h5>Achievements</h5>' + highlights(w, interactive) : ''), w.custom?.focusTopics,
      interactive ? w.custom?.filterKeywords || [] : undefined, w.custom?.filterOwnKeywords),
    ).join('') + (interactive ? '<p class="filter-empty" hidden>No experience matches these keywords.</p>' : ''),
    interactive ? 'experience filter-section' : 'experience'),
    section('Projects I\'m proud of', projects.map(p => entry(
      link(p.name, p.url),
      // resume-cli aliases summary and description before calling the theme.
      [inline(p.custom?.label || (p.description?.trim() !== p.summary?.trim() && p.description?.trim()) || p.type)],
      prose(p.summary) + highlights(p, interactive), p.custom?.focusTopics,
      interactive ? p.custom?.filterKeywords || [] : undefined, p.custom?.filterOwnKeywords
    )).join('') + (interactive ? '<p class="filter-empty" hidden>No projects match these keywords.</p>' : ''),
    interactive ? 'filter-section' : ''),
    section('Professional Skills', skillRows(skills)),
    section('Education', education.map(e => entry(escape([e.studyType, e.area].filter(Boolean).join(' in ')),
      [link(e.institution, e.url), period(e)], prose(e.summary) + list((e.courses || []).map(inline)))).join('')),
    section('Languages', list(languages.map(({ language, fluency }) =>
      escape(language) + (fluency ? ' (' + escape(fluency) + ')' : '')))),
    // section('Certificates', certificates.map(c => entry(link(c.name, c.url), [escape(c.issuer), date(c.date)])).join('')),
    // section('Volunteer', volunteer.map(v => entry(escape(v.position), [link(v.organization, v.url), period(v)],
    //   prose(v.summary) + highlights(v))).join('')),
    // section('Awards', awards.map(a => entry(escape(a.title), [escape(a.awarder), date(a.date)], prose(a.summary))).join('')),
    // section('Publications', publications.map(p => entry(link(p.name, p.url), [escape(p.publisher), date(p.releaseDate)], prose(p.summary))).join('')),
    // section('Interests', list(interests.map(i => [escape(i.name), (i.keywords || []).map(escape).join(', ')].filter(Boolean).join(' — ')))),
    // section('References', references.map(r => entry(escape(r.name), [], prose(r.reference))).join(''))
  ];
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(basics.name || 'Resume')}</title>${interactive ? '<link rel="alternate" type="text/markdown" href="/resume.md" title="Markdown resume">' : ''}<style>${css}</style></head><body>${interactive ? toolbar(keywords) : ''}<main>${header(basics)}${sections.join('')}</main>${interactive ? filterScript : ''}</body></html>`;
}

module.exports = { render, pdfRenderOptions: { format: 'A4', preferCSSPageSize: true, mediaType: 'print' } };
