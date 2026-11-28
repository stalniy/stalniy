const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const yaml = require('js-yaml');
const { render } = require('../jsonresume-theme');
const { renderMarkdown } = require('../scripts/render-markdown');
const { fetchSkill, preprocessSkill, generatePrompt } = require('../scripts/jd-match-prompt');

const root = path.resolve(__dirname, '..');

test('pinned skill transformation matches snapshot and retains assessment rules', async () => {
  const methodology = preprocessSkill(await fetchSkill());
  assert.equal(methodology, fs.readFileSync(path.join(__dirname, 'snapshots/jd-methodology.md'), 'utf8'));
  for (const phrase of ['must-have', 'nice-to-have', 'responsibility', 'Explicit', 'Semantic',
    'Unclear', 'Missing', 'requirement matrix', 'screening questions', 'keyword frequency']) {
    assert.ok(methodology.includes(phrase), `Missing matching instruction: ${phrase}`);
  }
  for (const phrase of ['YAML', 'frontmatter', 'Keyword analysis', 'Suggested edits',
    'additional material', 'resume bullets', 'Integrate relevant keywords', 'Identify relevant job-description keywords']) {
    assert.ok(!methodology.includes(phrase), `Unexpected removed instruction: ${phrase}`);
  }
});

test('prompt contains the complete Markdown CV and job description placeholder', () => {
  const cv = renderMarkdown(yaml.load(fs.readFileSync(path.join(root, 'resume.yaml'), 'utf8')));
  const prompt = generatePrompt('## Workflow\n\nCompare evidence.\n', cv);
  assert.ok(prompt.includes(cv.trim()));
  assert.ok(prompt.includes('## Job description\n\n[Paste the job description here]'));
  assert.ok(prompt.includes('strengths and potential gaps'));
  assert.ok(generatePrompt('Method', cv, 'Senior engineer').endsWith('Senior engineer\n'));
});

test('interactive CV includes accessible actions and print exclusions', () => {
  const resume = yaml.load(fs.readFileSync(path.join(root, 'resume.yaml'), 'utf8'));
  const html = render(resume, { interactive: true, matchPrompt: 'Prompt', methodologyUrl: 'https://example.com' });
  const print = render(resume);
  const css = fs.readFileSync(path.join(root, 'jsonresume-theme/style.css'), 'utf8');
  assert.match(html, /<dialog[^>]+aria-labelledby="match-title"[^>]+aria-describedby="match-description"/);
  assert.match(html, /<label for="match-jd">/);
  assert.match(html, /role="status" aria-live="polite"/);
  assert.match(html, /navigator\.clipboard\.writeText\(text\)/);
  assert.match(html, /data-umami-event="book-call-click"/);
  assert.match(html, /jd-match-provider-click/);
  assert.match(css, /@media screen and \(max-width: 640px\)[\s\S]*?\.cv-actions \{[^}]*flex-direction: row/);
  assert.match(css, /@media print \{[^}]*\.cv-actions, \.match-dialog \{ display: none !important/);
  assert.ok(!print.includes('class="cv-actions"'));
  assert.ok(!print.includes('<dialog'));
});

test('dialog copies only on request and sends content-free analytics', async () => {
  const resume = yaml.load(fs.readFileSync(path.join(root, 'resume.yaml'), 'utf8'));
  const html = render(resume, { interactive: true, matchPrompt: 'CV\n[Paste the job description here]', methodologyUrl: 'https://example.com' });
  const script = html.split('<script>')[1].split('</script>')[0];
  const events = [];
  const handlers = {};
  const copied = [];
  const elements = Object.fromEntries(['match-dialog', 'open-match', 'close-match', 'match-feedback',
    'match-jd', 'copy-match'].map(id => [id, {
    value: '', textContent: '',
    addEventListener(name, handler) { handlers[`${id}:${name}`] = handler; },
    showModal() { this.open = true; }, close() { this.open = false; }, focus() { this.focused = true; },
    querySelectorAll() { return [{ dataset: { matchProvider: 'Claude' }, addEventListener(name, handler) {
      handlers[`provider:${name}`] = handler;
    } }]; }
  }]));
  vm.runInNewContext(script, {
    document: { getElementById: id => elements[id] },
    navigator: { clipboard: { async writeText(value) { copied.push(value); } } },
    window: { umami: { track: (name, data) => events.push([name, data]) } }
  });
  assert.equal(copied.length, 0);
  handlers['open-match:click']();
  assert.equal(elements['match-dialog'].open, true);
  elements['match-jd'].value = 'Senior engineer role';
  await handlers['copy-match:click']();
  handlers['provider:click']();
  assert.deepEqual(copied, ['CV\nSenior engineer role']);
  assert.equal(elements['match-feedback'].textContent, 'Evaluation prompt copied.');
  assert.deepEqual(events.map(([name]) => name), ['jd-match-open', 'jd-match-prompt-copy', 'jd-match-provider-click']);
  assert.equal(events[2][1].provider, 'Claude');
  assert.ok(!JSON.stringify(events).includes('Senior engineer role'));
});
