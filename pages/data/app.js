import { sources, sourceReviewDate } from './sources.js';

const body = document.getElementById('sourceRows');
sources.forEach(source => {
  const row = document.createElement('tr');
  const title = document.createElement('th'); title.scope = 'row';
  const name = document.createElement('span'); name.className = 'source-title'; name.textContent = source.title;
  const organization = document.createElement('span'); organization.className = 'source-organization'; organization.textContent = source.organization;
  title.append(name, organization);
  const year = document.createElement('td'); year.className = 'source-year'; year.textContent = source.year;
  const frequency = document.createElement('span'); frequency.className = 'source-frequency'; frequency.textContent = source.frequency + '更新'; year.append(frequency);
  const use = document.createElement('td'); use.className = 'source-use'; use.textContent = source.use;
  const note = document.createElement('span'); note.className = 'source-note'; note.textContent = source.note; use.append(note);
  const reference = document.createElement('td'); reference.className = 'source-reference';
  const link = document.createElement('a'); link.className = 'source-link'; link.href = 'https://data.gov.tw/dataset/' + source.id;
  link.target = '_blank'; link.rel = 'noopener noreferrer'; link.setAttribute('aria-label', source.title + ' 官方來源（另開分頁）');
  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  icon.setAttribute('width','18'); icon.setAttribute('height','18'); icon.setAttribute('viewBox','0 0 24 24');
  icon.setAttribute('fill','none'); icon.setAttribute('stroke','currentColor'); icon.setAttribute('stroke-width','1.8'); icon.setAttribute('aria-hidden','true');
  icon.style.cssText = 'width:18px;height:18px;max-width:18px;max-height:18px'; icon.classList.add('source-icon');
  const symbol = document.createElementNS('http://www.w3.org/2000/svg', 'use'); symbol.setAttribute('href','../../shared/vendor/lucide/search.svg#icon'); icon.append(symbol);
  link.append(icon, '查看來源');
  const id = document.createElement('span'); id.className = 'dataset-id'; id.textContent = '資料集 ' + source.id;
  reference.append(link, id); row.append(title, year, use, reference); body.append(row);
});
document.getElementById('sourceReviewDate').textContent = sourceReviewDate;
document.getElementById('aboutButton').addEventListener('click', () => document.getElementById('aboutDialog').showModal());
