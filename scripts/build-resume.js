const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const { render } = require('../jsonresume-theme');
const { renderMarkdown } = require('./render-markdown');
const { fetchSkill, preprocessSkill, generatePrompt, METHODOLOGY_URL } = require('./jd-match-prompt');

const root = path.resolve(__dirname, '..');
const resume = yaml.load(fs.readFileSync(path.join(root, 'resume.yaml'), 'utf8'));

if (!resume || typeof resume !== 'object' || Array.isArray(resume)) {
  throw new Error('resume.yaml must contain a resume object');
}

const resumeMarkdown = renderMarkdown(resume);
fs.writeFileSync(path.join(root, 'resume.md'), resumeMarkdown);

function normalize(keyword) {
  return String(keyword).trim().toLowerCase().replace(/\s+/g, '-');
}

const keywordLabels = new Map();
const keywordCounts = new Map();
for (const section of ['work', 'projects']) {
  resume[section] = (resume[section] || []).map(item => {
    const { highlights, ...custom } = item.custom || {};
    const ownKeywords = item.keywords || [];
    const highlightKeywords = (highlights || []).map(highlight => highlight.keywords || []);
    for (const keyword of [...ownKeywords, ...highlightKeywords.flat()]) {
      const key = normalize(keyword);
      if (!keywordLabels.has(key)) keywordLabels.set(key, keyword);
      keywordCounts.set(key, (keywordCounts.get(key) || 0) + 1);
    }
    return {
      ...item,
      highlights: highlights ? highlights.map(highlight => highlight.summary) : item.highlights,
      custom: {
        ...custom,
        filterKeywords: [...new Set([...ownKeywords, ...highlightKeywords.flat()].map(normalize))],
        filterOwnKeywords: [...new Set(ownKeywords.map(normalize))],
        filterHighlightKeywords: highlightKeywords.map(keywords => [...new Set(keywords.map(normalize))])
      }
    };
  });
}

fs.writeFileSync(path.join(root, 'resume.json'), JSON.stringify(resume, null, 2) + '\n');
async function buildHtml() {
  const methodology = preprocessSkill(await fetchSkill());
  fs.writeFileSync(path.join(root, 'resume.html'), render(resume, {
    interactive: true,
    matchPrompt: generatePrompt(methodology, resumeMarkdown),
    methodologyUrl: METHODOLOGY_URL,
    keywords: [...keywordLabels].sort((a, b) =>
      keywordCounts.get(b[0]) - keywordCounts.get(a[0]) || a[1].localeCompare(b[1]))
  }) + '\n');
}

buildHtml().catch(error => { console.error(error); process.exitCode = 1; });
