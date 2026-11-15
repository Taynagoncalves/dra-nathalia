import { useQuery, useQueryClient } from '@tanstack/react-query';
import Placeholder from '@tiptap/extension-placeholder';
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  ArrowLeft,
  Bold,
  Check,
  Code,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListOrdered,
  Loader2,
  Quote,
  Redo2,
  Strikethrough,
  Underline,
  Undo2,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { normalizeUrl } from '@/components/materials/LinkFormModal';
import { ErrorBlock, LoadingBlock } from '@/components/ui/States';
import { materialKeys } from '@/hooks/useMaterials';
import { useSubject } from '@/hooks/useStudyData';
import { useUid } from '@/hooks/useUid';
import { cn } from '@/lib/cn';
import { friendlyError } from '@/lib/firebaseErrors';
import { getMaterial, getNote, saveNote, updateMaterial } from '@/services/firebase/materials';
import NotFound from '../NotFound';

type SaveState = 'salvo' | 'pendente' | 'salvando' | 'erro';
const AUTOSAVE_MS = 1000;

/** Editor de anotação (texto rico) com salvamento automático. */
export default function NoteEditorPage() {
  const { subjectId = '', noteId = '' } = useParams();
  const uid = useUid();
  const subject = useSubject(subjectId);
  const data = useQuery({
    queryKey: materialKeys.note(uid, noteId),
    queryFn: async () => {
      const [material, note] = await Promise.all([getMaterial(uid, noteId), getNote(uid, noteId)]);
      return { material, note };
    },
    // Sempre busca a versão mais nova ao abrir (pode ter sido editada em outro aparelho).
    staleTime: 0,
    gcTime: 0,
  });

  if (data.isLoading) return <LoadingBlock label="Abrindo anotação…" />;
  if (data.isError) return <ErrorBlock error={data.error} onRetry={() => data.refetch()} />;
  const material = data.data?.material;
  if (!material || material.kind !== 'note' || material.subjectId !== subjectId) return <NotFound />;

  const backTo = `/materias/${subjectId}${material.folderId ? `?pasta=${material.folderId}` : ''}`;

  return (
    <NoteEditor
      uid={uid}
      noteId={noteId}
      subjectId={subjectId}
      subjectName={subject.data?.name ?? 'Matéria'}
      backTo={backTo}
      initialTitle={material.title}
      initialContent={data.data?.note?.content ?? ''}
    />
  );
}

interface NoteEditorProps {
  uid: string;
  noteId: string;
  subjectId: string;
  subjectName: string;
  backTo: string;
  initialTitle: string;
  initialContent: string;
}

function NoteEditor({ uid, noteId, subjectId, subjectName, backTo, initialTitle, initialContent }: NoteEditorProps) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(initialTitle);
  const [saveState, setSaveState] = useState<SaveState>('salvo');
  const timer = useRef<number | undefined>(undefined);
  const pending = useRef<string | null>(null);

  const flush = useCallback(async () => {
    window.clearTimeout(timer.current);
    const html = pending.current;
    if (html === null) return;
    pending.current = null;
    setSaveState('salvando');
    try {
      await saveNote(uid, noteId, subjectId, html);
      setSaveState(pending.current === null ? 'salvo' : 'pendente');
      qc.invalidateQueries({ queryKey: materialKeys.materials(uid, subjectId) });
    } catch (err) {
      pending.current ??= html; // tenta de novo na próxima alteração
      setSaveState('erro');
      toast.error(friendlyError(err, 'Não foi possível salvar a anotação.'));
    }
  }, [uid, noteId, subjectId, qc]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: { openOnClick: false, autolink: true, defaultProtocol: 'https' } }),
      Placeholder.configure({ placeholder: 'Comece a escrever… (use a barra acima para títulos, listas e destaques)' }),
    ],
    content: initialContent,
    editorProps: { attributes: { class: 'tiptap min-h-[50vh] px-5 py-4 sm:px-8', 'aria-label': 'Conteúdo da anotação' } },
    onUpdate: ({ editor: e }) => {
      pending.current = e.getHTML();
      setSaveState('pendente');
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(flush, AUTOSAVE_MS);
    },
  });

  // Salva o que faltar ao sair da página ou fechar a aba.
  useEffect(() => {
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (pending.current !== null) {
        flush();
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      flush();
    };
  }, [flush]);

  const saveTitle = async () => {
    const value = title.trim() || 'Sem título';
    if (value !== title) setTitle(value);
    if (value === initialTitle) return;
    try {
      await updateMaterial(uid, noteId, { title: value });
      qc.invalidateQueries({ queryKey: materialKeys.materials(uid, subjectId) });
    } catch (err) {
      toast.error(friendlyError(err));
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-3 flex items-center justify-between gap-3">
        <Link to={backTo} className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-primary-text">
          <ArrowLeft className="size-4" /> {subjectName}
        </Link>
        <SaveIndicator state={saveState} />
      </div>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={saveTitle}
        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), editor?.commands.focus())}
        maxLength={150}
        aria-label="Título da anotação"
        className="mb-4 w-full bg-transparent text-2xl font-bold text-text outline-none placeholder:text-text-muted sm:text-3xl"
        placeholder="Título"
      />

      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        {editor && <Toolbar editor={editor} />}
        <EditorContent editor={editor} className="bg-bg" />
      </div>
    </div>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  const map: Record<SaveState, { text: string; icon: ReactNode; className: string }> = {
    salvo: { text: 'Salvo', icon: <Check className="size-3.5" />, className: 'text-success' },
    pendente: { text: 'Alterações não salvas', icon: null, className: 'text-text-muted' },
    salvando: { text: 'Salvando…', icon: <Loader2 className="size-3.5 animate-spin" />, className: 'text-text-muted' },
    erro: { text: 'Erro ao salvar', icon: null, className: 'text-error' },
  };
  const s = map[state];
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs', s.className)} aria-live="polite">
      {s.icon}
      {s.text}
    </span>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  // Re-renderiza a barra quando a seleção/formatação muda.
  const st = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      strike: e.isActive('strike'),
      h2: e.isActive('heading', { level: 2 }),
      h3: e.isActive('heading', { level: 3 }),
      bullet: e.isActive('bulletList'),
      ordered: e.isActive('orderedList'),
      quote: e.isActive('blockquote'),
      code: e.isActive('code'),
      link: e.isActive('link'),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });

  const setLink = () => {
    const current = editor.getAttributes('link').href as string | undefined;
    const raw = window.prompt('Endereço do link (deixe vazio para remover):', current ?? 'https://');
    if (raw === null) return;
    const url = normalizeUrl(raw);
    const chain = editor.chain().focus().extendMarkRange('link');
    if (!raw.trim() || !url) chain.unsetLink().run();
    else chain.setLink({ href: url }).run();
  };

  const c = () => editor.chain().focus();
  const buttons: { label: string; icon: ReactNode; active?: boolean; disabled?: boolean; run: () => void; sep?: boolean }[] = [
    { label: 'Negrito (Ctrl+B)', icon: <Bold />, active: st.bold, run: () => c().toggleBold().run() },
    { label: 'Itálico (Ctrl+I)', icon: <Italic />, active: st.italic, run: () => c().toggleItalic().run() },
    { label: 'Sublinhado (Ctrl+U)', icon: <Underline />, active: st.underline, run: () => c().toggleUnderline().run() },
    { label: 'Tachado', icon: <Strikethrough />, active: st.strike, run: () => c().toggleStrike().run() },
    { label: 'Título', icon: <Heading2 />, active: st.h2, run: () => c().toggleHeading({ level: 2 }).run(), sep: true },
    { label: 'Subtítulo', icon: <Heading3 />, active: st.h3, run: () => c().toggleHeading({ level: 3 }).run() },
    { label: 'Lista', icon: <List />, active: st.bullet, run: () => c().toggleBulletList().run(), sep: true },
    { label: 'Lista numerada', icon: <ListOrdered />, active: st.ordered, run: () => c().toggleOrderedList().run() },
    { label: 'Citação', icon: <Quote />, active: st.quote, run: () => c().toggleBlockquote().run() },
    { label: 'Código / artigo de lei', icon: <Code />, active: st.code, run: () => c().toggleCode().run() },
    { label: 'Link', icon: <Link2 />, active: st.link, run: setLink },
    { label: 'Desfazer (Ctrl+Z)', icon: <Undo2 />, disabled: !st.canUndo, run: () => c().undo().run(), sep: true },
    { label: 'Refazer (Ctrl+Y)', icon: <Redo2 />, disabled: !st.canRedo, run: () => c().redo().run() },
  ];

  return (
    <div role="toolbar" aria-label="Formatação" className="sticky top-16 z-10 flex flex-wrap items-center gap-0.5 border-b border-border bg-surface px-2 py-1.5">
      {buttons.map((b) => (
        <span key={b.label} className="flex items-center">
          {b.sep && <span className="mx-1 h-5 w-px bg-border" aria-hidden />}
          <button
            type="button"
            onClick={b.run}
            disabled={b.disabled}
            title={b.label}
            aria-label={b.label}
            aria-pressed={b.active}
            className={cn(
              'grid size-8 place-items-center rounded-md transition-colors [&_svg]:size-4',
              b.active ? 'bg-primary-soft text-primary-text' : 'text-text-muted hover:bg-primary-soft hover:text-text',
              'disabled:opacity-40 disabled:hover:bg-transparent',
            )}
          >
            {b.icon}
          </button>
        </span>
      ))}
    </div>
  );
}
