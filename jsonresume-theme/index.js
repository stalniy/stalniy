import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('./style.css', import.meta.url), 'utf8');
const OSS_RESEARCH_PROMPT = readFileSync(new URL('./research-prompt.md', import.meta.url), 'utf8');

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

function socialMeta(basics) {
  const title = `${basics.name || 'Resume'} — Resume`;
  const description = String(basics.summary || basics.label || '')
    .split(/\n\s*\n/)[0].replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
  const image = 'https://sstotskyi.dev/assets/master-cv-thumbnail.png';
  return `<meta name="description" content="${escape(description)}">` +
    `<meta property="og:type" content="website">` +
    `<meta property="og:title" content="${escape(title)}">` +
    `<meta property="og:description" content="${escape(description)}">` +
    `<meta property="og:url" content="https://sstotskyi.dev/">` +
    `<meta property="og:image" content="${image}">` +
    `<meta property="og:image:width" content="1200">` +
    `<meta property="og:image:height" content="630">` +
    `<meta property="og:image:alt" content="${escape(title)}">` +
    `<meta name="twitter:card" content="summary_large_image">` +
    `<meta name="twitter:title" content="${escape(title)}">` +
    `<meta name="twitter:description" content="${escape(description)}">` +
    `<meta name="twitter:image" content="${image}">`;
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

const bookCall = `<a class="book-call" href="https://cal.com/sstotskyi/15min" target="_blank" rel="noopener noreferrer" data-umami-event="book-call-click"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/></svg><span>Book a call</span></a>`;

function matchUi(prompt, methodologyUrl) {
  const safePrompt = JSON.stringify(prompt).replace(/</g, '\\u003c');
  return `<div class="cv-actions"><button type="button" class="match-action" id="open-match"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M5 3.5h9l4 4V14M5 3.5v17h9M14 3.5V8h4M8 11h6M8 14h4"/><path d="m18 16 .7 1.8L20.5 18.5l-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7L18 16Z"/><path d="M21 13v2M20 14h2"/></svg><span class="match-label">Match to your role</span><span class="match-label-short">Match role</span></button>${bookCall}</div>
<dialog class="match-dialog" id="match-dialog" aria-labelledby="match-title" aria-describedby="match-description">
  <div class="match-dialog-inner"><button type="button" class="match-close" id="close-match" aria-label="Close dialog">×</button>
    <h2 id="match-title">Match to your role</h2>
    <p id="match-description">Paste a job description, copy the evaluation prompt, then use it with your preferred AI assistant. The prompt includes my full CV and asks for an evidence-based assessment of strengths and gaps.</p>
    <label for="match-jd">Job description <span>(optional)</span></label>
    <textarea id="match-jd" rows="7" placeholder="Paste your job description here"></textarea>
    <p class="match-note">Your job description stays in this browser until you choose to paste the copied prompt into an AI assistant.</p>
    <button type="button" class="match-copy" id="copy-match">Copy evaluation prompt</button>
    <p class="match-feedback" id="match-feedback" role="status" aria-live="polite"></p>
    <p class="match-providers">Open an AI assistant: <a href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer" data-match-provider="ChatGPT">ChatGPT</a> · <a href="https://claude.ai/" target="_blank" rel="noopener noreferrer" data-match-provider="Claude">Claude</a> · <a href="https://gemini.google.com/" target="_blank" rel="noopener noreferrer" data-match-provider="Gemini">Gemini</a></p>
    <p class="match-source">Based on the <a href="${escape(methodologyUrl)}" target="_blank" rel="noopener noreferrer">open-source evaluation methodology</a>.</p>
  </div>
</dialog>
<script>(() => {
  const prompt = ${safePrompt};
  const dialog = document.getElementById('match-dialog');
  const opener = document.getElementById('open-match');
  const feedback = document.getElementById('match-feedback');
  const track = (name, data) => { if (window.umami?.track) window.umami.track(name, data); };
  opener.addEventListener('click', () => { dialog.showModal(); track('jd-match-open'); });
  document.getElementById('close-match').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { feedback.textContent = ''; opener.focus(); });
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  document.getElementById('copy-match').addEventListener('click', async () => {
    const jd = document.getElementById('match-jd').value.trim();
    const text = prompt.replace('[Paste the job description here]', jd || '[Paste the job description here]');
    try {
      await navigator.clipboard.writeText(text);
      feedback.textContent = 'Evaluation prompt copied.';
      track('jd-match-prompt-copy');
    } catch {
      feedback.textContent = 'Could not copy automatically. Check browser clipboard permissions and try again.';
    }
  });
  dialog.querySelectorAll('[data-match-provider]').forEach(link => link.addEventListener('click', () =>
    track('jd-match-provider-click', { provider: link.dataset.matchProvider })));
})();</script>`;
}

function researchAction() {
  return `<div class="research-action-row"><button type="button" class="research-action" id="open-research" aria-haspopup="dialog"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5M18 3v4M16 5h4"/></svg><span>Explore my open-source work with AI</span></button></div>`;
}

function researchUi() {
  const safePrompt = JSON.stringify(OSS_RESEARCH_PROMPT).replace(/</g, '\\u003c');
  return `<dialog class="match-dialog research-dialog" id="research-dialog" aria-labelledby="research-title" aria-describedby="research-description">
  <div class="match-dialog-inner"><button type="button" class="match-close" id="close-research" aria-label="Close dialog">×</button>
    <h2 id="research-title">Research my open-source contributions</h2>
    <p id="research-description">Independently evaluate my engineering expertise, technical contributions, and open-source impact using publicly available evidence.</p>
    <details id="research-prompt-details"><summary>View research prompt</summary><pre id="research-prompt"></pre></details>
    <button type="button" class="match-copy" id="copy-research">Copy research prompt</button>
    <p class="match-feedback" id="research-feedback" role="status" aria-live="polite"></p>
    <p>For the most thorough assessment, enable Deep Research mode in Gemini and paste the copied prompt.</p>
    <a class="research-provider" href="https://gemini.google.com/" target="_blank" rel="noopener noreferrer" data-research-provider="Gemini">Open Gemini</a>
    <p class="research-note">The prompt also works with other AI assistants that support web research.</p>
  </div>
</dialog>
<script>(() => {
  const prompt = ${safePrompt};
  const dialog = document.getElementById('research-dialog');
  const opener = document.getElementById('open-research');
  const close = document.getElementById('close-research');
  const feedback = document.getElementById('research-feedback');
  const details = document.getElementById('research-prompt-details');
  const track = (name, data) => { if (window.umami?.track) window.umami.track(name, data); };
  document.getElementById('research-prompt').textContent = prompt;
  opener.addEventListener('click', () => { dialog.showModal(); close.focus(); track('oss-research-open'); });
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { feedback.textContent = ''; details.open = false; opener.focus(); });
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  details.addEventListener('toggle', () => { if (details.open) track('oss-research-prompt-expand'); });
  document.getElementById('copy-research').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      feedback.textContent = 'Research prompt copied.';
      track('oss-research-prompt-copy');
    } catch {
      feedback.textContent = 'Could not copy automatically. Check browser clipboard permissions and try again.';
    }
  });
  dialog.querySelector('[data-research-provider]').addEventListener('click', event =>
    track('oss-research-provider-click', { provider: event.currentTarget.dataset.researchProvider }));
})();</script>`;
}

function scope(work, skillNames) {
  const summary = work.summary?.trim();
  const skills = (work.skills || []).slice(0, 8).map(skill => escape(skillNames.get(skill) || skill)).join(', ');
  if (!summary && !skills) return '';
  return '<div class="scope-row">' + (summary ? '<h5>Scope</h5>' : '') +
    (skills ? '<span class="work-skills">' + skills + '</span>' : '') + '</div>' + prose(summary);
}

function render(resume, { interactive = false, keywords = [], matchPrompt = '', methodologyUrl = '' } = {}) {
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
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(basics.name || 'Resume')}</title>${interactive ? '<link rel="alternate" type="text/markdown" href="/resume.md" title="Markdown resume">' + socialMeta(basics) : ''}<style>${css}</style></head><body>${interactive ? toolbar(keywords) : ''}<main>${header(basics)}${interactive ? researchAction() : ''}${sections.join('')}</main>${interactive ? matchUi(matchPrompt, methodologyUrl) + researchUi() + filterScript : ''}</body></html>`;
}

const pdfRenderOptions = {
  format: 'A4',
  preferCSSPageSize: true,
  mediaType: 'print'
};

export { render, pdfRenderOptions };
