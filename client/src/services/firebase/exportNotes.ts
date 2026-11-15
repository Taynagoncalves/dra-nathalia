import { getDocs, query, where } from 'firebase/firestore';
import { escapeHtml } from '@/lib/exporters';
import type { Material, Note, Subject } from '@/types/models';
import { docsWithId, userCol } from './db';

/** Todas as anotações de uma matéria (ou de todas), num único HTML para exportar. */
export async function collectNotesHtml(uid: string, subjects: Pick<Subject, 'id' | 'name'>[]) {
  const ids = new Set(subjects.map((s) => s.id));
  const [materials, notes] = await Promise.all([
    getDocs(subjects.length === 1 ? query(userCol(uid, 'materials'), where('subjectId', '==', subjects[0]!.id)) : userCol(uid, 'materials')),
    getDocs(subjects.length === 1 ? query(userCol(uid, 'notes'), where('subjectId', '==', subjects[0]!.id)) : userCol(uid, 'notes')),
  ]);
  const content = new Map(docsWithId<Note>(notes).map((n) => [n.id, n.content]));
  const list = docsWithId<Material>(materials)
    .filter((m) => m.kind === 'note' && ids.has(m.subjectId))
    .sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'));
  const multi = subjects.length > 1;
  const parts: string[] = [];
  for (const s of subjects) {
    const mine = list.filter((m) => m.subjectId === s.id);
    if (!mine.length) continue;
    if (multi) parts.push(`<h2 class="page-break">${escapeHtml(s.name)}</h2>`);
    for (const m of mine) parts.push(`<${multi ? 'h3' : 'h2'}>${escapeHtml(m.title)}</${multi ? 'h3' : 'h2'}>${content.get(m.id) || '<p><em>(anotação vazia)</em></p>'}`);
  }
  return { html: parts.join('\n'), count: list.length };
}
