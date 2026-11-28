import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import yaml from 'js-yaml';
import { render } from '../jsonresume-theme/index.js';

const root = path.resolve(import.meta.dirname, '..');
const resume = yaml.load(fs.readFileSync(path.join(root, 'resume.yaml'), 'utf8'));
const OSS_RESEARCH_PROMPT = fs.readFileSync(path.join(root, 'jsonresume-theme/research-prompt.md'), 'utf8');

test('research action follows contact links and stays out of print output', () => {
  const html = render(resume, { interactive: true });
  const print = render(resume);
  const css = fs.readFileSync(path.join(root, 'jsonresume-theme/style.css'), 'utf8');
  assert.match(html, /<\/header><div class="research-action-row">[\s\S]*?<\/div><section class="summary">/);
  assert.match(html, /<span>Explore my open-source work with AI<\/span><\/button>/);
  assert.match(css, /\.research-action \{[^}]*padding: 0; border: 0; background: none; color: #215347; font: inherit;/);
  assert.match(css, /\.research-action:focus-visible \{[^}]*outline: 2px solid #215347/);
  assert.match(css, /@media screen and \(max-width: 640px\)[\s\S]*?\.book-call, \.match-action \{ min-height: 44px;/);
  assert.match(html, /<dialog class="match-dialog research-dialog"[^>]*aria-labelledby="research-title"[^>]*aria-describedby="research-description"/);
  assert.match(html, /<details id="research-prompt-details"><summary>View research prompt<\/summary>/);
  assert.match(html, /<ol class="research-steps"><li>Copy the research prompt\.<\/li><li>Open your preferred AI assistant with web research enabled\.<\/li><li>Paste the prompt and start research\.<\/li><\/ol>/);
  for (const [provider, url] of [
    ['ChatGPT', 'https://chatgpt.com/'],
    ['Gemini', 'https://gemini.google.com/'],
    ['Perplexity', 'https://www.perplexity.ai/']
  ]) {
    assert.ok(html.includes(`href="${url}" target="_blank" rel="noopener noreferrer" data-research-provider="${provider}"`));
  }
  assert.match(html, /Web search is required for reliable results\. Deep Research is recommended where available\. Availability and usage limits depend on your AI provider and subscription\./);
  assert.doesNotMatch(html, /enable Deep Research mode in Gemini/);
  assert.ok(!print.includes('<div class="research-action-row">'));
  assert.ok(!print.includes('<dialog class="match-dialog research-dialog"'));
  assert.ok(!OSS_RESEARCH_PROMPT.includes(resume.basics.summary));
});

test('research dialog copies its independent prompt and tracks content-free events', async () => {
  const html = render(resume, { interactive: true });
  const script = '(() => {' + html.split('<script>(() => {')[2].split('</script>')[0];
  const events = [];
  const handlers = {};
  const copied = [];
  const providerLinks = ['ChatGPT', 'Gemini', 'Perplexity'].map(provider => ({
    dataset: { researchProvider: provider },
    addEventListener(name, handler) { handlers[`provider:${provider}:${name}`] = handler; }
  }));
  const elements = Object.fromEntries(['research-dialog', 'open-research', 'close-research',
    'research-feedback', 'research-prompt-details', 'research-prompt', 'copy-research'].map(id => [id, {
    textContent: '', open: false,
    addEventListener(name, handler) { handlers[`${id}:${name}`] = handler; },
    showModal() { this.open = true; }, close() { this.open = false; }, focus() { this.focused = true; },
    querySelectorAll() { return providerLinks; }
  }]));
  vm.runInNewContext(script, {
    document: { getElementById: id => elements[id] },
    navigator: { clipboard: { async writeText(value) { copied.push(value); } } },
    window: { umami: { track: (name, data) => events.push([name, data]) } }
  });
  assert.equal(elements['research-prompt'].textContent, OSS_RESEARCH_PROMPT);
  handlers['open-research:click']();
  assert.equal(elements['research-dialog'].open, true);
  assert.equal(elements['close-research'].focused, true);
  elements['research-prompt-details'].open = true;
  handlers['research-prompt-details:toggle']();
  await handlers['copy-research:click']();
  for (const provider of ['ChatGPT', 'Gemini', 'Perplexity']) handlers[`provider:${provider}:click`]();
  handlers['research-dialog:close']();
  assert.deepEqual(copied, [OSS_RESEARCH_PROMPT]);
  assert.equal(elements['open-research'].focused, true);
  assert.equal(elements['research-prompt-details'].open, false);
  assert.deepEqual(events.map(([name]) => name), [
    'oss-research-open', 'oss-research-prompt-expand', 'oss-research-prompt-copy',
    'oss-research-provider-click', 'oss-research-provider-click', 'oss-research-provider-click'
  ]);
  assert.deepEqual(events.slice(3).map(([, data]) => data.provider), ['ChatGPT', 'Gemini', 'Perplexity']);
  assert.ok(!JSON.stringify(events).includes(OSS_RESEARCH_PROMPT));
});
