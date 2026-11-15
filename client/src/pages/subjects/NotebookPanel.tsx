import { ChevronDown, LayoutGrid, MessageSquareText } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ChatPanel } from '@/components/notebook/ChatPanel';
import { SourcesPanel } from '@/components/notebook/SourcesPanel';
import { StudioPanel } from '@/components/notebook/StudioPanel';
import { readyForAi } from '@/components/materials/MaterialCard';
import { Alert } from '@/components/ui/Alert';
import { Card } from '@/components/ui/Card';
import { LoadingBlock } from '@/components/ui/States';
import { Tabs } from '@/components/ui/Tabs';
import { useMaterials } from '@/hooks/useMaterials';
import { useAiStatus } from '@/hooks/useQuizzes';

type View = 'chat' | 'estudio';

/**
 * Caderno IA (estilo NotebookLM) da matéria: fontes à esquerda; chat com
 * citações e estúdio (resumo, guia, FAQ, linha do tempo, mapa mental).
 */
export function NotebookPanel({ subjectId, onGoToMaterials }: { subjectId: string; onGoToMaterials: () => void }) {
  const materials = useMaterials(subjectId);
  const ai = useAiStatus();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [view, setView] = useState<View>('chat');

  const list = useMemo(() => materials.data ?? [], [materials.data]);
  const hasReady = list.some(readyForAi);
  const materialIds = [...selected].filter((id) => list.some((m) => m.id === id && readyForAi(m)));

  if (materials.isLoading) return <LoadingBlock label="Abrindo o Caderno IA…" />;

  const sources = <SourcesPanel materials={list} selected={selected} onChange={setSelected} onGoToMaterials={onGoToMaterials} />;
  const notConfigured = ai.data && !ai.data.configured;

  return (
    <div className="space-y-4">
      {notConfigured && (
        <Alert variant="warning" title="IA não configurada">
          Falta a chave da IA no servidor (GEMINI_API_KEY — gratuita). Veja a seção “IA” do README.
        </Alert>
      )}
      <div className="grid gap-4 lg:grid-cols-[17rem_1fr]">
        {/* Fontes: lateral no computador, recolhível no celular */}
        <Card className="hidden h-fit p-4 lg:block">{sources}</Card>
        <details className="group rounded-xl border border-border bg-surface lg:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between p-3 text-sm font-semibold text-text">
            Fontes {materialIds.length ? `(${materialIds.length} marcadas)` : '(todas)'}
            <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
          </summary>
          <div className="px-3 pb-3">{sources}</div>
        </details>

        <Card className="p-4">
          <Tabs<View>
            className="mb-4"
            value={view}
            onChange={setView}
            items={[
              { value: 'chat', label: 'Chat', icon: MessageSquareText },
              { value: 'estudio', label: 'Estúdio', icon: LayoutGrid },
            ]}
          />
          {view === 'chat' ? (
            <ChatPanel subjectId={subjectId} materialIds={materialIds} disabled={!hasReady || !!notConfigured} />
          ) : (
            <StudioPanel subjectId={subjectId} materialIds={materialIds} disabled={!hasReady || !!notConfigured} />
          )}
          {ai.data?.configured && (
            <p className="mt-4 text-right text-[11px] text-text-muted">
              Usos da IA hoje: {ai.data.used}/{ai.data.limit}
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
