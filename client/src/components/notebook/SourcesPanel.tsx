import { Upload } from 'lucide-react';
import { KindIcon, quizzable, readyForAi } from '@/components/materials/MaterialCard';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/cn';
import type { Material } from '@/types/models';

interface SourcesPanelProps {
  materials: Material[];
  selected: Set<string>;
  onChange: (ids: Set<string>) => void;
  onGoToMaterials: () => void;
}

/** Fontes do Caderno IA: os materiais da matéria que a IA pode ler. */
export function SourcesPanel({ materials, selected, onChange, onGoToMaterials }: SourcesPanelProps) {
  const usable = materials.filter(quizzable);
  const ready = usable.filter(readyForAi);
  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };
  const allSelected = ready.length > 0 && ready.every((m) => selected.has(m.id));

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-text">Fontes</p>
        {ready.length > 0 && (
          <button
            type="button"
            onClick={() => onChange(allSelected ? new Set() : new Set(ready.map((m) => m.id)))}
            className="text-xs font-medium text-primary-text hover:underline"
          >
            {allSelected ? 'Desmarcar todas' : 'Marcar todas'}
          </button>
        )}
      </div>
      {!usable.length ? (
        <div className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-text-muted">
          <p>Nenhuma fonte ainda.</p>
          <button type="button" onClick={onGoToMaterials} className="mt-2 inline-flex items-center gap-1 font-medium text-primary-text hover:underline">
            <Upload className="size-4" /> Enviar PDFs ou escrever anotações
          </button>
        </div>
      ) : (
        <ul className="space-y-1 overflow-y-auto">
          {usable.map((m) => {
            const ok = readyForAi(m);
            return (
              <li key={m.id}>
                <label
                  className={cn(
                    'flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 transition-colors',
                    ok ? 'hover:bg-primary-soft/50' : 'cursor-not-allowed opacity-60',
                  )}
                  title={ok ? m.title : m.aiError ?? 'Ainda não está pronto para a IA'}
                >
                  <input type="checkbox" disabled={!ok} checked={ok && selected.has(m.id)} onChange={() => toggle(m.id)} className="accent-(--primary)" />
                  <KindIcon material={m} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-sm text-text">{m.title}</span>
                  {!ok && <Badge variant={m.aiStatus === 'erro' ? 'warning' : 'neutral'}>{m.aiStatus === 'processando' ? 'Processando' : m.aiStatus === 'erro' ? 'Sem texto' : 'Preparar'}</Badge>}
                </label>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-3 text-xs text-text-muted">
        {selected.size ? `${selected.size} de ${ready.length} fonte(s) marcadas.` : 'Nenhuma marcada = usa todas as fontes prontas.'}
      </p>
    </div>
  );
}
