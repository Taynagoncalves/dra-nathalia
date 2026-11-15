import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  ArrowDownUp,
  Download,
  ExternalLink,
  Eye,
  Folder as FolderIcon,
  FolderInput,
  FolderOpen,
  FolderPlus,
  LayoutGrid,
  Link2,
  List,
  NotebookPen,
  Pencil,
  Plus,
  Search,
  SearchX,
  Sparkles,
  Star,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type MouseEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { DeleteFolderDialog } from '@/components/materials/DeleteFolderDialog';
import { DraggableFolder, DraggableMaterial, ExplorerBreadcrumb, parseDrag, parseDrop } from '@/components/materials/dnd';
import { FolderCard } from '@/components/materials/FolderCard';
import { downloadUrl, KIND_META, KIND_ORDER } from '@/components/materials/kinds';
import { LinkFormModal } from '@/components/materials/LinkFormModal';
import { MaterialCard, MaterialRow, quizzable, readyForAi } from '@/components/materials/MaterialCard';
import { QuizConfigModal } from '@/components/quiz/QuizConfigModal';
import { MaterialEditModal } from '@/components/materials/MaterialEditModal';
import { MaterialViewer } from '@/components/materials/MaterialViewer';
import { MoveToDialog } from '@/components/materials/MoveToDialog';
import { FolderFormModal } from '@/components/materials/FolderFormModal';
import { UploadQueuePanel } from '@/components/materials/UploadQueuePanel';
import { ActionMenuButton, ContextMenu, type Action, type ContextMenuState } from '@/components/ui/ActionMenu';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';
import { EmptyState } from '@/components/ui/Feedback';
import { Input, Select } from '@/components/ui/Field';
import { ErrorBlock, LoadingBlock } from '@/components/ui/States';
import { ACCEPT_ATTR, MAX_UPLOAD_MB } from '@/config/constants';
import { iconByName } from '@/config/icons';
import { useMaterialMutations, useFolders, useMaterials } from '@/hooks/useMaterials';
import { useTopics } from '@/hooks/useStudyData';
import { useUploadQueue } from '@/hooks/useUploadQueue';
import { cn } from '@/lib/cn';
import { canMoveFolder, childrenMap, descendantIds, pathTo } from '@/lib/folderTree';
import { allTags, explorerView, hasActiveFilters, NO_FILTERS, type SortKey, type ViewFilters } from '@/lib/materialsView';
import type { Folder, Material, QuizSource } from '@/types/models';
import { processMaterialForAi } from '@/services/ai';
import { friendlyError } from '@/lib/firebaseErrors';

type ViewMode = 'grade' | 'lista';
const VIEW_KEY = 'materiais-visao';
const readView = (): ViewMode => {
  try {
    return localStorage.getItem(VIEW_KEY) === 'lista' ? 'lista' : 'grade';
  } catch {
    return 'grade';
  }
};

type MoveTarget = { kind: 'folder'; folder: Folder } | { kind: 'material'; material: Material };

/** Aba "Materiais": gerenciador de arquivos da matéria, no estilo Google Drive. */
export function MaterialsPanel({ subjectId, subjectName }: { subjectId: string; subjectName: string }) {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const folders = useFolders(subjectId);
  const materials = useMaterials(subjectId);
  const topics = useTopics(subjectId);
  const m = useMaterialMutations(subjectId);
  const uploads = useUploadQueue(subjectId);
  const fileInput = useRef<HTMLInputElement>(null);

  const [view, setView] = useState<ViewMode>(readView);
  const [sort, setSort] = useState<SortKey>('nome');
  const [filters, setFilters] = useState<ViewFilters>(NO_FILTERS);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [folderForm, setFolderForm] = useState<{ folder?: Folder } | null>(null);
  const [deletingFolder, setDeletingFolder] = useState<Folder | null>(null);
  const [deletingMaterial, setDeletingMaterial] = useState<Material | null>(null);
  const [moving, setMoving] = useState<MoveTarget | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [editing, setEditing] = useState<Material | null>(null);
  const [viewing, setViewing] = useState<Material | null>(null);
  const [viewPage, setViewPage] = useState<number | null>(null);
  const [quizFor, setQuizFor] = useState<{ source: QuizSource; label: string } | null>(null);
  const [dragging, setDragging] = useState<{ kind: 'folder' | 'material'; label: string } | null>(null);
  const [fileOver, setFileOver] = useState(false);
  const fileDragDepth = useRef(0);

  const allFolders = useMemo(() => folders.data ?? [], [folders.data]);
  const allMaterials = useMemo(() => materials.data ?? [], [materials.data]);
  const topicList = topics.data ?? [];

  /* ── Pasta atual (fica na URL: ?pasta=ID) ───────────────────────── */
  const folderParam = params.get('pasta');
  const currentFolder = allFolders.find((f) => f.id === folderParam) ?? null;
  const currentFolderId = currentFolder?.id ?? null;
  const path = useMemo(() => pathTo(allFolders, currentFolderId), [allFolders, currentFolderId]);

  const goTo = useCallback(
    (folderId: string | null) => {
      setParams((p) => {
        const next = new URLSearchParams(p);
        if (folderId) next.set('pasta', folderId);
        else next.delete('pasta');
        return next;
      });
      setFilters(NO_FILTERS);
    },
    [setParams],
  );

  // Link direto para um material (ex.: trecho de origem de uma questão): ?abrir=ID&pagina=N
  useEffect(() => {
    const abrir = params.get('abrir');
    if (!abrir || !materials.isSuccess) return;
    const mat = allMaterials.find((x) => x.id === abrir);
    setParams(
      (p) => {
        const next = new URLSearchParams(p);
        next.delete('abrir');
        next.delete('pagina');
        return next;
      },
      { replace: true },
    );
    if (!mat) return;
    if (mat.kind === 'note') navigate(`/materias/${subjectId}/anotacoes/${mat.id}`);
    else if (mat.cloudinary) {
      setViewPage(Number(params.get('pagina')) || null);
      setViewing(mat);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, materials.isSuccess]);

  // Pasta da URL foi excluída → volta para a raiz.
  useEffect(() => {
    if (folderParam && folders.isSuccess && !currentFolder) goTo(null);
  }, [folderParam, folders.isSuccess, currentFolder, goTo]);

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_KEY, view);
    } catch {
      /* ignore */
    }
  }, [view]);

  /* ── O que mostrar ─────────────────────────────────────────────── */
  const shown = useMemo(
    () => explorerView(allFolders, allMaterials, currentFolderId, filters, sort),
    [allFolders, allMaterials, currentFolderId, filters, sort],
  );
  const tags = useMemo(() => allTags(allMaterials), [allMaterials]);
  const folderById = useMemo(() => new Map(allFolders.map((f) => [f.id, f])), [allFolders]);
  const topicById = useMemo(() => new Map(topicList.map((t) => [t.id, t.name])), [topicList]);
  const tree = useMemo(() => childrenMap(allFolders), [allFolders]);
  const itemCount = (folderId: string) =>
    (tree.get(folderId)?.length ?? 0) + allMaterials.filter((x) => x.folderId === folderId).length;
  const locationOf = (folderId: string | null) =>
    folderId ? pathTo(allFolders, folderId).map((f) => f.name).join(' › ') : subjectName;

  /* ── Ações ─────────────────────────────────────────────────────── */
  const openMaterial = (mat: Material) => {
    if (mat.kind === 'link' && mat.linkUrl) window.open(mat.linkUrl, '_blank', 'noopener,noreferrer');
    else if (mat.kind === 'note') navigate(`/materias/${subjectId}/anotacoes/${mat.id}`);
    else setViewing(mat);
  };

  const moveMaterial = async (mat: Material, target: string | null) => {
    if ((mat.folderId ?? null) === target) return;
    await m.updateMaterial.mutateAsync({ id: mat.id, data: { folderId: target } });
    toast.success(`“${mat.title}” movido para ${target ? folderById.get(target)?.name : subjectName}.`);
  };

  const moveFolder = async (folder: Folder, target: string | null) => {
    if ((folder.parentId ?? null) === target) return;
    if (!canMoveFolder(allFolders, folder.id, target)) {
      toast.error('Não dá para mover uma pasta para dentro dela mesma.');
      return;
    }
    await m.updateFolder.mutateAsync({ id: folder.id, data: { parentId: target } });
    toast.success(`Pasta “${folder.name}” movida para ${target ? folderById.get(target)?.name : subjectName}.`);
  };

  const createNote = async () => {
    try {
      const id = await m.createNote.mutateAsync({ folderId: currentFolderId, title: 'Nova anotação' });
      navigate(`/materias/${subjectId}/anotacoes/${id}`);
    } catch {
      /* toast já exibido */
    }
  };

  /** Quiz com IA a partir de um material ou de uma pasta inteira (com subpastas). */
  const quizFromMaterial = (mat: Material) => setQuizFor({ source: { type: 'material', subjectId, materialIds: [mat.id] }, label: `Material: ${mat.title}` });
  const quizFromFolder = (f: Folder) => setQuizFor({ source: { type: 'folder', subjectId, folderId: f.id }, label: `Pasta: ${f.name} (com subpastas)` });

  const prepareForAi = async (mat: Material) => {
    const id = toast.loading(`Lendo “${mat.title}” para a IA…`);
    try {
      const r = await processMaterialForAi(mat.id);
      if (r.status === 'pronto') toast.success('Pronto para a IA!', { id });
      else toast.error(r.error ?? 'Não foi possível ler este arquivo.', { id });
    } catch (err) {
      toast.error(friendlyError(err), { id });
    } finally {
      materials.refetch();
    }
  };

  const folderActions = (f: Folder): Action[] => [
    { label: 'Abrir', icon: <FolderOpen className="size-4" />, onSelect: () => goTo(f.id) },
    { label: 'Renomear / cor', icon: <Pencil className="size-4" />, onSelect: () => setFolderForm({ folder: f }) },
    { label: 'Mover para…', icon: <FolderInput className="size-4" />, onSelect: () => setMoving({ kind: 'folder', folder: f }) },
    { label: 'Gerar quiz desta pasta', icon: <Sparkles className="size-4" />, onSelect: () => quizFromFolder(f) },
    { label: 'Excluir', icon: <Trash2 className="size-4" />, onSelect: () => setDeletingFolder(f), danger: true, separator: true },
  ];

  const materialActions = (mat: Material): Action[] => {
    const download = downloadUrl(mat);
    const aiAction: Action[] = !quizzable(mat)
      ? []
      : readyForAi(mat)
        ? [{ label: 'Gerar quiz com IA', icon: <Sparkles className="size-4" />, onSelect: () => quizFromMaterial(mat) }]
        : mat.aiStatus === 'processando'
          ? [{ label: 'Processando para a IA…', icon: <Sparkles className="size-4" />, onSelect: () => {}, disabled: true }]
          : [{ label: mat.aiStatus === 'erro' ? 'Tentar ler de novo para a IA' : 'Preparar para a IA', icon: <Sparkles className="size-4" />, onSelect: () => prepareForAi(mat) }];
    return [
      {
        label: mat.kind === 'link' ? 'Abrir link' : 'Abrir',
        icon: mat.kind === 'link' ? <ExternalLink className="size-4" /> : <Eye className="size-4" />,
        onSelect: () => openMaterial(mat),
      },
      { label: 'Editar (título, tags, assunto)', icon: <Pencil className="size-4" />, onSelect: () => setEditing(mat) },
      {
        label: mat.favorite ? 'Remover dos favoritos' : 'Favoritar',
        icon: <Star className="size-4" />,
        onSelect: () => m.updateMaterial.mutate({ id: mat.id, data: { favorite: !mat.favorite } }),
      },
      { label: 'Mover para…', icon: <FolderInput className="size-4" />, onSelect: () => setMoving({ kind: 'material', material: mat }) },
      ...(download
        ? [{ label: 'Baixar', icon: <Download className="size-4" />, onSelect: () => window.open(download, '_blank', 'noopener') }]
        : []),
      ...aiAction,
      { label: 'Excluir', icon: <Trash2 className="size-4" />, onSelect: () => setDeletingMaterial(mat), danger: true, separator: true },
    ];
  };

  const showContextMenu = (e: MouseEvent, actions: Action[]) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, actions });
  };
  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  /* ── Arrastar e soltar (itens entre pastas) ─────────────────────── */
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  );

  const onDragStart = ({ active }: DragStartEvent) => {
    const { kind, id } = parseDrag(String(active.id));
    const label = kind === 'folder' ? folderById.get(id)?.name : allMaterials.find((x) => x.id === id)?.title;
    setDragging({ kind, label: label ?? '' });
  };

  const onDragEnd = async ({ active, over }: DragEndEvent) => {
    setDragging(null);
    if (!over) return;
    const { kind, id } = parseDrag(String(active.id));
    const target = parseDrop(String(over.id));
    try {
      if (kind === 'material') {
        const mat = allMaterials.find((x) => x.id === id);
        if (mat) await moveMaterial(mat, target);
      } else {
        const folder = folderById.get(id);
        if (folder && folder.id !== target) await moveFolder(folder, target);
      }
    } catch {
      /* toast já exibido */
    }
  };

  /* ── Arquivos do computador soltos na área ─────────────────────── */
  const hasFiles = (e: DragEvent) => e.dataTransfer?.types?.includes('Files');
  const fileDropHandlers = {
    onDragEnter: (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      fileDragDepth.current += 1;
      setFileOver(true);
    },
    onDragOver: (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    },
    onDragLeave: (e: DragEvent) => {
      if (!hasFiles(e)) return;
      fileDragDepth.current -= 1;
      if (fileDragDepth.current <= 0) setFileOver(false);
    },
    onDrop: (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      fileDragDepth.current = 0;
      setFileOver(false);
      uploads.enqueue(e.dataTransfer.files, currentFolderId);
    },
  };

  /* ── Contagens para o diálogo de exclusão de pasta ─────────────── */
  const deleteCounts = useMemo(() => {
    if (!deletingFolder) return { folders: 0, materials: 0, files: 0 };
    const ids = descendantIds(allFolders, deletingFolder.id);
    const inside = allMaterials.filter((x) => x.folderId && ids.has(x.folderId));
    return { folders: ids.size - 1, materials: inside.length, files: inside.filter((x) => x.cloudinary).length };
  }, [deletingFolder, allFolders, allMaterials]);

  /* ── Render ────────────────────────────────────────────────────── */
  if (folders.isLoading || materials.isLoading) return <LoadingBlock label="Carregando materiais…" />;
  if (folders.isError) return <ErrorBlock error={folders.error} onRetry={() => folders.refetch()} />;
  if (materials.isError) return <ErrorBlock error={materials.error} onRetry={() => materials.refetch()} />;

  const filtersOn = hasActiveFilters(filters);
  const isEmpty = shown.folders.length === 0 && shown.materials.length === 0;
  const hereName = currentFolder?.name ?? subjectName;

  const newMenu = (
    <Dropdown
      className="min-w-56"
      trigger={({ toggle, open }) => (
        <Button onClick={toggle} aria-expanded={open}>
          <Plus className="size-4" /> Novo
        </Button>
      )}
    >
      {(close) => (
        <>
          <DropdownItem icon={<FolderPlus className="size-4" />} onSelect={() => (close(), setFolderForm({}))}>
            Pasta
          </DropdownItem>
          <DropdownItem icon={<Upload className="size-4" />} onSelect={() => (close(), fileInput.current?.click())}>
            Enviar arquivos
          </DropdownItem>
          <DropdownItem icon={<Link2 className="size-4" />} onSelect={() => (close(), setLinkOpen(true))}>
            Link
          </DropdownItem>
          <DropdownItem icon={<NotebookPen className="size-4" />} onSelect={() => (close(), createNote())}>
            Anotação
          </DropdownItem>
        </>
      )}
    </Dropdown>
  );

  return (
    <div className="relative min-h-[50vh]" {...fileDropHandlers}>
      <input
        ref={fileInput}
        type="file"
        multiple
        accept={ACCEPT_ATTR}
        className="hidden"
        onChange={(e) => {
          if (e.target.files) uploads.enqueue(e.target.files, currentFolderId);
          e.target.value = '';
        }}
      />

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
        {/* Barra de ferramentas */}
        <div className="mb-4 space-y-3">
          <ExplorerBreadcrumb subjectName={subjectName} path={path} onNavigate={goTo} />

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-48 flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-muted" aria-hidden />
              <Input
                value={filters.search}
                onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                placeholder="Buscar em toda a matéria…"
                aria-label="Buscar materiais"
                className="pl-9"
              />
            </div>
            {newMenu}
            <div className="flex rounded-lg border border-border bg-surface p-0.5" role="group" aria-label="Modo de exibição">
              {(['grade', 'lista'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  aria-pressed={view === v}
                  aria-label={v === 'grade' ? 'Grade' : 'Lista'}
                  className={cn('rounded-md p-1.5', view === v ? 'bg-primary-soft text-primary-text' : 'text-text-muted hover:text-text')}
                >
                  {v === 'grade' ? <LayoutGrid className="size-4" /> : <List className="size-4" />}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-1.5">
              <ArrowDownUp className="size-4 text-text-muted" aria-hidden />
              <span className="sr-only">Ordenar por</span>
              <Select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="h-9 w-28">
                <option value="nome">Nome</option>
                <option value="data">Data</option>
                <option value="tipo">Tipo</option>
              </Select>
            </label>
          </div>

          {/* Filtros */}
          <div className="flex flex-wrap items-center gap-1.5">
            <FilterChip active={filters.kind === 'todos'} onClick={() => setFilters((f) => ({ ...f, kind: 'todos' }))}>
              Todos
            </FilterChip>
            {KIND_ORDER.map((k) => (
              <FilterChip key={k} active={filters.kind === k} onClick={() => setFilters((f) => ({ ...f, kind: f.kind === k ? 'todos' : k }))}>
                {KIND_META[k].label}
              </FilterChip>
            ))}
            <FilterChip active={filters.favorites} onClick={() => setFilters((f) => ({ ...f, favorites: !f.favorites }))}>
              <Star className={cn('size-3.5', filters.favorites && 'fill-current')} /> Favoritos
            </FilterChip>
            {tags.length > 0 && (
              <Select
                value={filters.tag}
                onChange={(e) => setFilters((f) => ({ ...f, tag: e.target.value }))}
                aria-label="Filtrar por tag"
                className="h-8 w-auto rounded-full text-xs"
              >
                <option value="">Todas as tags</option>
                {tags.map((t) => (
                  <option key={t} value={t}>
                    #{t}
                  </option>
                ))}
              </Select>
            )}
            {filtersOn && (
              <Button variant="ghost" size="sm" onClick={() => setFilters(NO_FILTERS)}>
                <X className="size-3.5" /> Limpar
              </Button>
            )}
          </div>
          {filtersOn && (
            <p className="text-xs text-text-muted" aria-live="polite">
              {shown.folders.length + shown.materials.length} resultado(s) em toda a matéria.
            </p>
          )}
        </div>

        {/* Conteúdo */}
        {isEmpty ? (
          <Card>
            {filtersOn ? (
              <EmptyState
                icon={SearchX}
                title="Nada encontrado"
                description="Tente outro termo ou limpe os filtros."
                action={
                  <Button variant="secondary" onClick={() => setFilters(NO_FILTERS)}>
                    Limpar filtros
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={currentFolder ? FolderOpen : FolderIcon}
                title={currentFolder ? 'Esta pasta está vazia' : 'Comece a organizar seus materiais'}
                description={`Crie pastas coloridas, envie PDFs, Word, slides e imagens (até ${MAX_UPLOAD_MB} MB cada), salve links ou escreva anotações. Você também pode arrastar arquivos para cá.`}
                action={
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button onClick={() => setFolderForm({})}>
                      <FolderPlus className="size-4" /> {currentFolder ? 'Criar subpasta' : 'Criar primeira pasta'}
                    </Button>
                    <Button variant="secondary" onClick={() => fileInput.current?.click()}>
                      <Upload className="size-4" /> Enviar arquivos
                    </Button>
                  </div>
                }
              />
            )}
          </Card>
        ) : (
          <div className="space-y-6">
            {shown.folders.length > 0 && (
              <section aria-label="Pastas">
                <h3 className="mb-2 text-xs font-semibold tracking-wide text-text-muted uppercase">Pastas</h3>
                <ul className={view === 'grade' ? 'grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'space-y-2'}>
                  {shown.folders.map((f) => (
                    <li key={f.id}>
                      <DraggableFolder folder={f} disabled={filtersOn}>
                        {(isOver) =>
                          view === 'grade' ? (
                            <FolderCard
                              name={f.name}
                              color={f.color}
                              icon={iconByName(f.icon, FolderIcon)}
                              itemCount={itemCount(f.id)}
                              highlight={isOver}
                              onOpen={() => goTo(f.id)}
                              onContextMenu={(e) => showContextMenu(e, folderActions(f))}
                              menu={<ActionMenuButton actions={folderActions(f)} label={`Ações da pasta ${f.name}`} />}
                              onGenerateQuiz={() => quizFromFolder(f)}
                            />
                          ) : (
                            <FolderRow
                              folder={f}
                              count={itemCount(f.id)}
                              highlight={isOver}
                              location={filtersOn ? locationOf(f.parentId) : undefined}
                              onOpen={() => goTo(f.id)}
                              onContextMenu={(e) => showContextMenu(e, folderActions(f))}
                              actions={folderActions(f)}
                            />
                          )
                        }
                      </DraggableFolder>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {shown.materials.length > 0 && (
              <section aria-label="Materiais">
                <h3 className="mb-2 text-xs font-semibold tracking-wide text-text-muted uppercase">Materiais</h3>
                <ul className={view === 'grade' ? 'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4' : 'space-y-2'}>
                  {shown.materials.map((mat) => {
                    const props = {
                      material: mat,
                      onOpen: () => openMaterial(mat),
                      onToggleFavorite: () => m.updateMaterial.mutate({ id: mat.id, data: { favorite: !mat.favorite } }),
                      actions: materialActions(mat),
                      onContextMenu: (e: MouseEvent) => showContextMenu(e, materialActions(mat)),
                      location: filtersOn ? locationOf(mat.folderId) : undefined,
                      topicName: mat.topicId ? topicById.get(mat.topicId) : undefined,
                      onGenerateQuiz: () => quizFromMaterial(mat),
                    };
                    return (
                      <li key={mat.id}>
                        <DraggableMaterial id={mat.id} disabled={filtersOn}>
                          {view === 'grade' ? <MaterialCard {...props} /> : <MaterialRow {...props} />}
                        </DraggableMaterial>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {!filtersOn && (
              <p className="text-center text-xs text-text-muted">
                Arraste itens para dentro de uma pasta (ou para o caminho no topo) para movê-los. Clique com o botão direito para ver as ações.
              </p>
            )}
          </div>
        )}

        <DragOverlay dropAnimation={null}>
          {dragging && (
            <div className="inline-flex max-w-64 items-center gap-2 rounded-lg border border-primary bg-surface-elevated px-3 py-2 text-sm font-medium text-text shadow-card">
              {dragging.kind === 'folder' ? <FolderIcon className="size-4 text-primary-text" /> : <FolderInput className="size-4 text-primary-text" />}
              <span className="truncate">{dragging.label}</span>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Camada de "solte para enviar" */}
      {fileOver && (
        <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center rounded-2xl border-2 border-dashed border-primary bg-primary-soft/80 backdrop-blur-[1px]">
          <div className="text-center">
            <Upload className="mx-auto mb-2 size-8 text-primary-text" />
            <p className="font-semibold text-primary-text">Solte para enviar para “{hereName}”</p>
            <p className="text-sm text-text-muted">PDF, Word, PowerPoint e imagens · até {MAX_UPLOAD_MB} MB cada</p>
          </div>
        </div>
      )}

      <ContextMenu menu={contextMenu} onClose={closeContextMenu} />
      <UploadQueuePanel items={uploads.items} onCancel={uploads.cancel} onRetry={uploads.retry} onClear={uploads.clearFinished} />
      <MaterialViewer
        material={viewing}
        page={viewPage}
        onClose={() => {
          setViewing(null);
          setViewPage(null);
        }}
      />
      <QuizConfigModal open={!!quizFor} onClose={() => setQuizFor(null)} source={quizFor?.source} sourceLabel={quizFor?.label} />

      <FolderFormModal
        open={!!folderForm}
        onClose={() => setFolderForm(null)}
        title={folderForm?.folder ? 'Editar pasta' : currentFolder ? `Nova subpasta em “${currentFolder.name}”` : 'Nova pasta'}
        submitLabel={folderForm?.folder ? 'Salvar' : 'Criar pasta'}
        initial={folderForm?.folder ? { name: folderForm.folder.name, color: folderForm.folder.color, icon: folderForm.folder.icon } : undefined}
        loading={m.createFolder.isPending || m.updateFolder.isPending}
        onSubmit={async (data) => {
          try {
            if (folderForm?.folder) {
              await m.updateFolder.mutateAsync({ id: folderForm.folder.id, data });
              toast.success('Pasta atualizada.');
            } else {
              await m.createFolder.mutateAsync({ parentId: currentFolderId, data, order: tree.get(currentFolderId ?? '')?.length ?? 0 });
              toast.success('Pasta criada.');
            }
            setFolderForm(null);
          } catch {
            /* toast já exibido */
          }
        }}
      />

      <DeleteFolderDialog
        open={!!deletingFolder}
        onClose={() => setDeletingFolder(null)}
        folderName={deletingFolder?.name ?? ''}
        parentName={deletingFolder?.parentId ? (folderById.get(deletingFolder.parentId)?.name ?? subjectName) : subjectName}
        counts={deleteCounts}
        loading={m.deleteFolder.isPending}
        onConfirm={async (mode) => {
          if (!deletingFolder) return;
          try {
            await m.deleteFolder.mutateAsync({ id: deletingFolder.id, mode });
            toast.success(mode === 'moveUp' ? 'Pasta excluída; o conteúdo subiu um nível.' : 'Pasta e conteúdo excluídos.');
            setDeletingFolder(null);
          } catch {
            /* toast já exibido */
          }
        }}
      />

      <ConfirmDialog
        open={!!deletingMaterial}
        onClose={() => setDeletingMaterial(null)}
        title={`Excluir “${deletingMaterial?.title}”?`}
        description={deletingMaterial?.cloudinary ? 'O arquivo também será apagado do Cloudinary. Não dá para desfazer.' : 'Não dá para desfazer.'}
        confirmLabel="Excluir"
        danger
        onConfirm={() => {
          if (deletingMaterial) {
            m.deleteMaterial.mutate(deletingMaterial, { onSuccess: () => toast.success('Material excluído.') });
          }
          setDeletingMaterial(null);
        }}
      />

      <MoveToDialog
        open={!!moving}
        onClose={() => setMoving(null)}
        itemName={moving?.kind === 'folder' ? moving.folder.name : (moving?.material.title ?? '')}
        folders={allFolders}
        subjectName={subjectName}
        currentFolderId={moving?.kind === 'folder' ? (moving.folder.parentId ?? null) : (moving?.material.folderId ?? null)}
        disabledIds={moving?.kind === 'folder' ? descendantIds(allFolders, moving.folder.id) : undefined}
        loading={m.updateFolder.isPending || m.updateMaterial.isPending}
        onConfirm={async (target) => {
          if (!moving) return;
          try {
            if (moving.kind === 'folder') await moveFolder(moving.folder, target);
            else await moveMaterial(moving.material, target);
            setMoving(null);
          } catch {
            /* toast já exibido */
          }
        }}
      />

      <LinkFormModal
        open={linkOpen}
        onClose={() => setLinkOpen(false)}
        loading={m.createLink.isPending}
        onSubmit={async (v) => {
          try {
            await m.createLink.mutateAsync({ folderId: currentFolderId, ...v });
            toast.success('Link salvo.');
            setLinkOpen(false);
          } catch {
            /* toast já exibido */
          }
        }}
      />

      <MaterialEditModal
        material={editing}
        topics={topicList}
        knownTags={tags}
        onClose={() => setEditing(null)}
        loading={m.updateMaterial.isPending}
        onSubmit={async (patch) => {
          if (!editing) return;
          try {
            await m.updateMaterial.mutateAsync({ id: editing.id, data: patch });
            toast.success('Material atualizado.');
            setEditing(null);
          } catch {
            /* toast já exibido */
          }
        }}
      />
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex h-8 items-center gap-1 rounded-full border px-3 text-xs font-medium transition-colors',
        active ? 'border-primary bg-primary-soft text-primary-text' : 'border-border text-text-muted hover:bg-primary-soft hover:text-text',
      )}
    >
      {children}
    </button>
  );
}

interface FolderRowProps {
  folder: Folder;
  count: number;
  highlight: boolean;
  location?: string;
  onOpen: () => void;
  onContextMenu: (e: MouseEvent) => void;
  actions: Action[];
}

function FolderRow({ folder, count, highlight, location, onOpen, onContextMenu, actions }: FolderRowProps) {
  const Icon = iconByName(folder.icon, FolderIcon);
  return (
    <div
      onContextMenu={onContextMenu}
      className={cn(
        'flex items-center gap-3 rounded-xl border bg-surface px-3 py-2 transition-shadow hover:shadow-card',
        highlight ? 'ring-2 ring-primary' : 'border-border',
      )}
      style={{ borderLeft: `4px solid ${folder.color}` }}
    >
      <Icon className="size-5 shrink-0" style={{ color: folder.color }} aria-hidden />
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
        <span className="block truncate text-sm font-medium text-text hover:text-primary-text">{folder.name}</span>
        <span className="block text-xs text-text-muted">
          {count} {count === 1 ? 'item' : 'itens'}
          {location && ` · em ${location}`}
        </span>
      </button>
      <ActionMenuButton actions={actions} label={`Ações da pasta ${folder.name}`} />
    </div>
  );
}

