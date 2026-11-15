import { BookOpen, ListChecks, NotebookPen, Play, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { IconTile } from '@/components/ui/IconTile';
import { Modal } from '@/components/ui/Modal';
import { useStudyTimer } from '@/contexts/StudyTimerContext';
import type { Recommendation } from '@/lib/recommend';
import { newSession } from '@/lib/solveSession';
import type { Question } from '@/types/models';

const KIND_LABEL: Record<Recommendation['kind'], string> = {
  acerto: 'Menor acerto',
  erros: 'Erros pendentes',
  pouco_estudo: 'Pouco estudada',
};

interface RecommendModalProps {
  open: boolean;
  onClose: () => void;
  recommendations: Recommendation[];
  suggestedQuestions: (subjectId: string, max: number) => Question[];
  pendingErrorCount: (subjectId: string) => number;
}

/** "O que devo estudar agora?" — Etapa 1: regra simples; Etapa 2: IA. */
export function RecommendModal({ open, onClose, recommendations, suggestedQuestions, pendingErrorCount }: RecommendModalProps) {
  const navigate = useNavigate();
  const timer = useStudyTimer();

  const solve = (subjectId: string) => {
    const qs = suggestedQuestions(subjectId, 10);
    if (!qs.length) return navigate(`/materias/${subjectId}?aba=questoes`);
    newSession(qs.map((q) => q.id), 'Sugestão: questões da matéria', '/');
    navigate('/questoes/resolver');
  };

  return (
    <Modal open={open} onClose={onClose} title="O que devo estudar agora?" description="Sugestões com base no seu desempenho, no caderno de erros e no tempo de estudo." size="lg">
      {recommendations.length === 0 ? (
        <div className="space-y-3 text-sm text-text-muted">
          <p>Crie um projeto com matérias para receber sugestões.</p>
          <Button
            onClick={() => {
              onClose();
              navigate('/projetos');
            }}
          >
            Ir para Projetos
          </Button>
        </div>
      ) : (
        <ol className="space-y-3">
          {recommendations.map((r, i) => {
            const qCount = suggestedQuestions(r.subject.id, 10).length;
            const eCount = pendingErrorCount(r.subject.id);
            return (
              <li key={r.subject.id} className={i === 0 ? 'rounded-xl border-2 border-primary bg-primary-soft/40 p-4' : 'rounded-xl border border-border p-4'}>
                <div className="flex items-start gap-3">
                  <IconTile icon={r.subject.icon} color={r.subject.color} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-text">{r.subject.name}</p>
                      {i === 0 && (
                        <Badge variant="primary">
                          <Sparkles className="size-3" /> Prioridade
                        </Badge>
                      )}
                      <Badge variant="neutral">{KIND_LABEL[r.kind]}</Badge>
                    </div>
                    <p className="mt-0.5 text-sm text-text-muted">{r.reason}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    disabled={!!timer.state}
                    title={timer.state ? 'Já há um timer ativo' : undefined}
                    onClick={() => {
                      timer.start(r.subject.id, 'Leitura');
                      onClose();
                      navigate(`/materias/${r.subject.id}`);
                    }}
                  >
                    <Play className="size-4" /> Estudar agora
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => (onClose(), solve(r.subject.id))}>
                    <ListChecks className="size-4" /> {qCount ? `Resolver ${qCount} questões` : 'Criar questões'}
                  </Button>
                  {eCount > 0 && (
                    <Button size="sm" variant="secondary" onClick={() => (onClose(), navigate(`/erros?materia=${r.subject.id}`))}>
                      <NotebookPen className="size-4" /> Ver {eCount} {eCount === 1 ? 'erro' : 'erros'}
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => (onClose(), navigate(`/materias/${r.subject.id}`))}>
                    <BookOpen className="size-4" /> Materiais
                  </Button>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      <p className="mt-4 text-xs text-text-muted">
        Regra atual: menor % de acerto → mais erros não resolvidos → matéria menos estudada nos últimos 7 dias. Na Etapa 2, a IA assume.
      </p>
    </Modal>
  );
}
