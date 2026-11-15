import { Check, Circle, CircleCheck, CircleDot, ListTree, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/Feedback';
import { Input } from '@/components/ui/Field';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { SortableList } from '@/components/ui/SortableList';
import { ErrorBlock, LoadingBlock } from '@/components/ui/States';
import { useTopicMutations, useTopics } from '@/hooks/useStudyData';
import { cn } from '@/lib/cn';
import type { Topic, TopicStatus } from '@/types/models';

const STATUS: { value: TopicStatus; label: string; icon: typeof Circle; className: string }[] = [
  { value: 'nao_iniciado', label: 'Não iniciado', icon: Circle, className: 'text-text-muted' },
  { value: 'estudando', label: 'Estudando', icon: CircleDot, className: 'text-warning' },
  { value: 'concluido', label: 'Concluído', icon: CircleCheck, className: 'text-success' },
];

/** Assuntos (tópicos) da matéria: criar, renomear, mudar status, reordenar e excluir. */
export function TopicsPanel({ subjectId }: { subjectId: string }) {
  const topics = useTopics(subjectId);
  const { create, update, remove, reorder } = useTopicMutations(subjectId);
  const [name, setName] = useState('');
  const [deleting, setDeleting] = useState<Topic>();

  const list = topics.data ?? [];
  const done = list.filter((t) => t.status === 'concluido').length;
  const percent = list.length ? Math.round((done / list.length) * 100) : 0;

  const add = async (e: FormEvent) => {
    e.preventDefault();
    const value = name.trim();
    if (!value) return;
    try {
      await create.mutateAsync({ name: value, order: list.length });
      setName('');
    } catch {
      /* toast já exibido */
    }
  };

  if (topics.isLoading) return <LoadingBlock label="Carregando assuntos…" />;
  if (topics.isError) return <ErrorBlock error={topics.error} onRetry={() => topics.refetch()} />;

  return (
    <div className="space-y-4">
      <form onSubmit={add} className="flex gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Novo assunto (ex.: Responsabilidade civil) e Enter"
          aria-label="Nome do novo assunto"
          maxLength={120}
        />
        <Button type="submit" loading={create.isPending} disabled={!name.trim()}>
          <Plus className="size-4" /> <span className="hidden sm:inline">Adicionar</span>
        </Button>
      </form>

      {list.length === 0 ? (
        <Card>
          <EmptyState
            icon={ListTree}
            title="Nenhum assunto ainda"
            description="Divida a matéria em assuntos. Marcar assuntos como concluídos alimenta o progresso do projeto."
          />
        </Card>
      ) : (
        <>
          <div className="flex items-center gap-3 text-sm">
            <ProgressBar value={percent} tone="success" label="Assuntos concluídos" className="flex-1" />
            <span className="shrink-0 text-text-muted">
              {done}/{list.length} concluídos
            </span>
          </div>
          <SortableList
            items={list}
            onReorder={(ordered) => reorder.mutate(ordered)}
            renderItem={(topic, handle) => (
              <TopicRow
                topic={topic}
                handle={handle}
                onRename={(newName) => update.mutate({ id: topic.id, data: { name: newName } })}
                onStatus={(status) => update.mutate({ id: topic.id, data: { status } })}
                onDelete={() => setDeleting(topic)}
              />
            )}
          />
        </>
      )}

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(undefined)}
        title={`Excluir “${deleting?.name}”?`}
        description="Materiais e questões ligados a este assunto continuam existindo, só perdem o vínculo."
        confirmLabel="Excluir"
        danger
        onConfirm={() => {
          if (deleting) remove.mutate(deleting.id);
          setDeleting(undefined);
        }}
      />
    </div>
  );
}

interface TopicRowProps {
  topic: Topic;
  handle: React.ReactNode;
  onRename: (name: string) => void;
  onStatus: (status: TopicStatus) => void;
  onDelete: () => void;
}

function TopicRow({ topic, handle, onRename, onStatus, onDelete }: TopicRowProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(topic.name);
  const current = STATUS.find((s) => s.value === topic.status) ?? STATUS[0]!;
  const StatusIcon = current.icon;

  const save = () => {
    const v = value.trim();
    if (v && v !== topic.name) onRename(v);
    setEditing(false);
  };

  // Clicar no ícone avança o status: não iniciado → estudando → concluído → não iniciado
  const cycle = () => {
    const i = STATUS.findIndex((s) => s.value === topic.status);
    onStatus(STATUS[(i + 1) % STATUS.length]!.value);
  };

  return (
    <div className="flex items-center gap-2 rounded-xl border border-border bg-surface p-2 pr-2">
      {handle}
      <button
        type="button"
        onClick={cycle}
        title={`${current.label} — clique para avançar`}
        aria-label={`Status: ${current.label}. Clique para avançar.`}
        className={cn('rounded-md p-1 hover:bg-primary-soft', current.className)}
      >
        <StatusIcon className="size-5" />
      </button>

      {editing ? (
        <form
          className="flex flex-1 items-center gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <Input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && (setValue(topic.name), setEditing(false))}
            className="h-8"
            aria-label="Nome do assunto"
          />
          <Button type="submit" variant="ghost" size="icon" className="size-8" aria-label="Salvar">
            <Check className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label="Cancelar"
            onClick={() => {
              setValue(topic.name);
              setEditing(false);
            }}
          >
            <X className="size-4" />
          </Button>
        </form>
      ) : (
        <>
          <span className={cn('min-w-0 flex-1 truncate text-sm', topic.status === 'concluido' ? 'text-text-muted line-through' : 'text-text')}>
            {topic.name}
          </span>
          <select
            value={topic.status}
            onChange={(e) => onStatus(e.target.value as TopicStatus)}
            aria-label="Status do assunto"
            className="hidden h-8 rounded-md border border-border bg-bg px-2 text-xs text-text sm:block"
          >
            {STATUS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <Button variant="ghost" size="icon" className="size-8" onClick={() => setEditing(true)} aria-label={`Renomear ${topic.name}`}>
            <Pencil className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" className="size-8 hover:text-error" onClick={onDelete} aria-label={`Excluir ${topic.name}`}>
            <Trash2 className="size-4" />
          </Button>
        </>
      )}
    </div>
  );
}
