const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const { render } = require('../jsonresume-theme');

const root = path.resolve(__dirname, '..');
const resume = yaml.load(fs.readFileSync(path.join(root, 'resume.yaml'), 'utf8'));

if (!resume || typeof resume !== 'object' || Array.isArray(resume)) {
  throw new Error('resume.yaml must contain a resume object');
}

const json = JSON.stringify(resume, null, 2) + '\n';
const html = render(resume) + '\n';

fs.writeFileSync(path.join(root, 'resume.json'), json);
fs.writeFileSync(path.join(root, 'resume.html'), html);
