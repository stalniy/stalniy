function prose(value) {
  return String(value || '').trim().split(/\n\s*\n/).filter(Boolean)
    .map(paragraph => paragraph.trim().replace(/\s*\n\s*/g, ' ')).join('\n\n');
}

function period(item, ongoing = false) {
  return [item.startDate, item.endDate || (ongoing && item.startDate ? 'Present' : '')]
    .filter(Boolean).join(' – ');
}

function highlights(item) {
  return (item.custom?.highlights || (item.highlights || []).map(summary => ({ summary })))
    .map(({ summary }) => prose(summary)).filter(Boolean).map(summary => `- ${summary}`).join('\n');
}

function place(location) {
  if (typeof location === 'string') return location;
  if (!location) return '';
  const country = location.countryCode === 'PL' ? 'Poland' : location.countryCode;
  return [location.city, location.region, country].filter(Boolean).join(', ');
}

function renderMarkdown(resume) {
  const { basics = {} } = resume;
  const lines = [`# ${basics.name}`, basics.label, ''];
  const contacts = [place(basics.location), basics.email, basics.phone, basics.url,
    ...(basics.profiles || []).map(profile => profile.url)].filter(Boolean);
  lines.push(contacts.join(' · '), '', '## Professional summary', '', prose(basics.summary));

  if (resume.work?.length) {
    lines.push('', '## Professional experience');
    const skillNames = new Map((resume.skills || []).filter(skill => skill.id)
      .map(skill => [skill.id, skill.name]));
    for (const work of resume.work) {
      lines.push('', `### ${work.position} — ${work.name}`, '',
        [period(work, true), place(work.location)].filter(Boolean).join(' · '));
      if (work.description) lines.push('', prose(work.description));
      if (work.summary) lines.push('', prose(work.summary));
      const achievements = highlights(work);
      if (achievements) lines.push('', achievements);
      if (work.skills?.length) lines.push('', `**Technologies:** ${work.skills.map(skill => skillNames.get(skill) || skill).join(', ')}`);
    }
  }

  if (resume.projects?.length) {
    lines.push('', '## Projects');
    for (const project of resume.projects) {
      lines.push('', `### ${project.name}`, '');
      const details = [project.custom?.label || project.type, period(project),
        project.roles?.join(', '), project.url].filter(Boolean);
      if (details.length) lines.push(details.join(' · '));
      if (project.description) lines.push('', prose(project.description));
      if (project.summary) lines.push('', prose(project.summary));
      const achievements = highlights(project);
      if (achievements) lines.push('', achievements);
    }
  }

  if (resume.skills?.length) {
    lines.push('', '## Skills', '');
    const groups = new Map();
    for (const skill of resume.skills) {
      const group = skill.custom?.group || 'Other';
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group).push(skill.name, ...(skill.keywords || []));
    }
    for (const [group, names] of groups) lines.push(`- **${group}:** ${names.join(', ')}`);
  }

  if (resume.education?.length) {
    lines.push('', '## Education');
    for (const item of resume.education) {
      lines.push('', `### ${item.institution}`, '',
        [[item.studyType, item.area].filter(Boolean).join(' in '), period(item)].filter(Boolean).join(' · '));
      if (item.summary) lines.push('', prose(item.summary));
      if (item.courses?.length) lines.push('', `Courses: ${item.courses.join(', ')}`);
    }
  }

  if (resume.certificates?.length) {
    lines.push('', '## Certificates', '');
    for (const item of resume.certificates) {
      lines.push(`- ${[item.name, item.issuer, item.date].filter(Boolean).join(' · ')}`);
    }
  }

  if (resume.languages?.length) {
    lines.push('', '## Languages', '');
    for (const item of resume.languages) lines.push(`- ${item.language}${item.fluency ? ` — ${item.fluency}` : ''}`);
  }

  if (resume.interests?.length) {
    lines.push('', '## Interests', '');
    for (const item of resume.interests) {
      lines.push(`- ${item.name}${item.keywords?.length ? ` — ${item.keywords.join(', ')}` : ''}`);
    }
  }

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

export { renderMarkdown };
