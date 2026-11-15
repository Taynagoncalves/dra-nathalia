import { Sparkles } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { SubjectSelect } from '@/components/ui/SubjectSelect';
import { useAiStatus } from '@/hooks/useQuizzes';
import { useTopics } from '@/hooks/useStudyData';
import { cn } from '@/lib/cn';
import { friendlyError } from '@/lib/firebaseErrors';
import { createQuiz } from '@/services/ai';
import type { QuizConfig, QuizDifficulty, QuizFocus, QuizMode, QuizQuestionType, QuizSource } from '@/types/models';

export const QUIZ_TYPE_LABELS: Record<QuizQuestionType, string> = {
  multipla: 'Múltipla escolha (A–E)',
  certo_errado: 'Certo ou errado (Cebraspe)',
  lacunas: 'Lacunas',
  discursiva: 'Discursiva curta',
};
const DIFFICULTY: { value: QuizDifficulty; label: string }[] = [
  { value: 'facil', label: 'Fácil' },
  { value: 'medio', label: 'Médio' },
  { value: 'dificil', label: 'Difícil' },
  { value: 'pegadinha', label: 'Pegadinha' },
  { value: 'oab', label: 'Nível OAB' },
  { value: 'concurso', label: 'Nível concurso' },
];
const MODES: { value: QuizMode; label: string; text: string }[] = [
  { value: 'treino', label: 'Treino', text: 'Gabarito e explicação após cada questão.' },
  { value: 'prova', label: 'Prova', text: 'Resultado só no final.' },
  { value: 'relampago', label: 'Relâmpago', text: 'Tempo limite por questão.' },
];
const FOCUS: { value: QuizFocus; label: string }[] = [
  { value: 'geral', label: 'Sem foco específico' },
  { value: 'artigos', label: 'Só artigos de lei' },
  { value: 'jurisprudencia', label: 'Só jurisprudência' },
  { value: 'conceitos', label: 'Só conceitos' },
];

const CONFIG_KEY = 'quiz-config';
const DEFAULT_CONFIG: QuizConfig = { count: 10, types: ['multipla'], difficulty: 'medio', mode: 'treino', timerSec: 60, focus: 'geral' };
const loadConfig = (): QuizConfig => {
  try {
    return { ...DEFAULT_CONFIG, ...JSON.parse(localStorage.getItem(CONFIG_KEY) ?? '{}') };
  } catch {
    return DEFAULT_CONFIG;
  }
};

type PickKind = 'subject' | 'topic' | 'tema' | 'errors';

interface QuizConfigModalProps {
  open: boolean;
  onClose: () => void;
  /** origem já definida (material, pasta…); sem ela, o modal mostra a escolha */
  source?: QuizSource;
  /** descrição da origem fixa (ex.: "Material: Apostila de Civil") */
  sourceLabel?: ReactNode;
  defaultSubjectId?: string;
  defaultKind?: PickKind;
  /** config inicial (ex.: repetir as mesmas opções) */
  initialConfig?: Partial<QuizConfig>;
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors',
        active ? 'border-primary bg-primary-soft text-primary-text' : 'border-border text-text-muted hover:bg-primary-soft hover:text-text',
      )}
    >
      {children}
    </button>
  );
}

/** Configuração do quiz antes de gerar (quantidade, tipos, dificuldade, modo, foco). */
export function QuizConfigModal({ open, onClose, source, sourceLabel, defaultSubjectId, defaultKind = 'subject', initialConfig }: QuizConfigModalProps) {
  const navigate = useNavigate();
  const ai = useAiStatus();
  const [config, setConfig] = useState<QuizConfig>(loadConfig);
  const [custom, setCustom] = useState('');
  const [subjectId, setSubjectId] = useState(defaultSubjectId ?? '');
  const [kind, setKind] = useState<PickKind>(defaultKind);
  const [topicId, setTopicId] = useState('');
  const [theme, setTheme] = useState('');
  const [busy, setBusy] = useState(false);
  const topics = useTopics(subjectId || undefined);

  useEffect(() => {
    if (!open) return;
    setConfig({ ...loadConfig(), ...initialConfig });
    setSubjectId(defaultSubjectId ?? '');
    setKind(defaultKind);
    setTopicId('');
    setTheme('');
    setCustom('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = <K extends keyof QuizConfig>(k: K, v: QuizConfig[K]) => setConfig((c) => ({ ...c, [k]: v }));
  const toggleType = (t: QuizQuestionType) =>
    set('types', config.types.includes(t) ? config.types.filter((x) => x !== t) : [...config.types, t]);

  const finalSource: QuizSource | null = source
    ? source
    : !subjectId
      ? null
      : kind === 'tema'
        ? theme.trim().length >= 3
          ? { type: 'tema', subjectId, theme: theme.trim() }
          : null
        : kind === 'errors'
          ? { type: 'errors', subjectId }
          : kind === 'topic'
            ? topicId
              ? { type: 'subject', subjectId, topicId }
              : null
            : { type: 'subject', subjectId };

  const count = custom ? Math.max(1, Math.min(30, Number(custom) || 0)) : config.count;
  const notConfigured = ai.data && !ai.data.configured;
  const limitReached = ai.data && ai.data.used >= ai.data.limit;
  const valid = !!finalSource && config.types.length > 0 && count >= 1 && !notConfigured && !limitReached;

  const submit = async () => {
    if (!finalSource || !valid) return;
    const cfg: QuizConfig = { ...config, count, timerSec: config.mode === 'relampago' ? config.timerSec ?? 60 : null };
    try {
      localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
    } catch {
      /* ignore */
    }
    setBusy(true);
    try {
      const { quizId } = await createQuiz(finalSource, cfg);
      onClose();
      navigate(`/quizzes/${quizId}`);
    } catch (err) {
      toast.error(friendlyError(err, 'Não foi possível começar o quiz.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Gerar quiz com IA"
      size="lg"
      footer={
        <>
          {ai.data?.configured && (
            <span className="mr-auto self-center text-xs text-text-muted">
              Usos da IA hoje: {ai.data.used}/{ai.data.limit}
            </span>
          )}
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={!valid} loading={busy}>
            <Sparkles className="size-4" /> Gerar {count} {count === 1 ? 'questão' : 'questões'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {notConfigured && (
          <Alert variant="warning" title="IA não configurada">
            Falta a chave da API do Claude no servidor (ANTHROPIC_API_KEY). Veja o README.
          </Alert>
        )}
        {limitReached && <Alert variant="warning">Você atingiu o limite diário de usos da IA. Ele renova amanhã.</Alert>}

        {/* Origem */}
        {source ? (
          sourceLabel && <div className="rounded-lg border border-border bg-bg p-3 text-sm text-text">{sourceLabel}</div>
        ) : (
          <div className="space-y-3">
            <Field label="Matéria">{(id) => <SubjectSelect id={id} value={subjectId} emptyLabel="Escolha…" onChange={(v) => (setSubjectId(v), setTopicId(''))} />}</Field>
            <fieldset>
              <legend className="mb-1.5 text-sm font-medium text-text">Gerar a partir de</legend>
              <div className="flex flex-wrap gap-1.5">
                <Chip active={kind === 'subject'} onClick={() => setKind('subject')}>Todos os materiais da matéria</Chip>
                <Chip active={kind === 'topic'} onClick={() => setKind('topic')}>Um assunto</Chip>
                <Chip active={kind === 'errors'} onClick={() => setKind('errors')}>Meus erros</Chip>
                <Chip active={kind === 'tema'} onClick={() => setKind('tema')}>Tema livre</Chip>
              </div>
            </fieldset>
            {kind === 'topic' && (
              <Select value={topicId} onChange={(e) => setTopicId(e.target.value)} aria-label="Assunto" disabled={!topics.data?.length}>
                <option value="">{topics.data?.length ? 'Escolha o assunto…' : 'A matéria não tem assuntos'}</option>
                {topics.data?.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            )}
            {kind === 'tema' && (
              <>
                <Input value={theme} onChange={(e) => setTheme(e.target.value)} placeholder="Ex.: Responsabilidade civil do Estado" maxLength={300} aria-label="Tema" />
                <Alert variant="info">Sem material: as questões não se baseiam nos seus arquivos. Confira os fundamentos na legislação.</Alert>
              </>
            )}
            {kind === 'errors' && (
              <p className="text-sm text-text-muted">A IA cria questões novas sobre os assuntos e confusões do seu caderno de erros (pendentes).</p>
            )}
          </div>
        )}

        {/* Quantidade */}
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-text">Quantidade</legend>
          <div className="flex flex-wrap items-center gap-1.5">
            {[5, 10, 15, 20].map((n) => (
              <Chip key={n} active={!custom && config.count === n} onClick={() => (setCustom(''), set('count', n))}>
                {n}
              </Chip>
            ))}
            <Input
              type="number"
              min={1}
              max={30}
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="Outra"
              aria-label="Quantidade personalizada (até 30)"
              className="h-9 w-24"
            />
          </div>
        </fieldset>

        {/* Tipos */}
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-text">Tipos de questão</legend>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {(Object.keys(QUIZ_TYPE_LABELS) as QuizQuestionType[]).map((t) => (
              <label key={t} className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-text hover:bg-primary-soft/40">
                <input type="checkbox" checked={config.types.includes(t)} onChange={() => toggleType(t)} className="accent-(--primary)" />
                {QUIZ_TYPE_LABELS[t]}
              </label>
            ))}
          </div>
          {!config.types.length && <p className="mt-1 text-xs text-error">Escolha pelo menos um tipo.</p>}
        </fieldset>

        {/* Dificuldade */}
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-text">Dificuldade</legend>
          <div className="flex flex-wrap gap-1.5">
            {DIFFICULTY.map((d) => (
              <Chip key={d.value} active={config.difficulty === d.value} onClick={() => set('difficulty', d.value)}>
                {d.label}
              </Chip>
            ))}
          </div>
        </fieldset>

        {/* Modo */}
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-text">Modo</legend>
          <div className="grid gap-1.5 sm:grid-cols-3">
            {MODES.map((m) => (
              <button
                key={m.value}
                type="button"
                aria-pressed={config.mode === m.value}
                onClick={() => set('mode', m.value)}
                className={cn(
                  'rounded-lg border p-3 text-left transition-colors',
                  config.mode === m.value ? 'border-primary bg-primary-soft' : 'border-border hover:bg-primary-soft/40',
                )}
              >
                <span className={cn('block text-sm font-semibold', config.mode === m.value ? 'text-primary-text' : 'text-text')}>{m.label}</span>
                <span className="block text-xs text-text-muted">{m.text}</span>
              </button>
            ))}
          </div>
          {config.mode === 'relampago' && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-sm text-text-muted">
              Tempo por questão:
              {[30, 45, 60, 90, 120].map((s) => (
                <Chip key={s} active={(config.timerSec ?? 60) === s} onClick={() => set('timerSec', s)}>
                  {s}s
                </Chip>
              ))}
            </div>
          )}
        </fieldset>

        {/* Foco */}
        <Field label="Foco (opcional)">
          {(id) => (
            <Select id={id} value={config.focus} onChange={(e) => set('focus', e.target.value as QuizFocus)}>
              {FOCUS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
    </Modal>
  );
}
