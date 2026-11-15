import { useQuery } from '@tanstack/react-query';
import { doc, getDoc } from 'firebase/firestore';
import { AlertTriangle, Loader2, RotateCcw, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { QuizConfigModal } from '@/components/quiz/QuizConfigModal';
import { QuizPlayer } from '@/components/quiz/QuizPlayer';
import { QuizResults, type ResultData } from '@/components/quiz/QuizResults';
import { Alert } from '@/components/ui/Alert';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorBlock, LoadingBlock } from '@/components/ui/States';
import { useLiveQuiz } from '@/hooks/useQuizzes';
import { useUid } from '@/hooks/useUid';
import { userCol } from '@/services/firebase/db';
import type { Quiz } from '@/types/models';
import NotFound from '../NotFound';

export default function QuizPage() {
  const { quizId = '' } = useParams();
  const { quiz, loading, error } = useLiveQuiz(quizId);
  const [finished, setFinished] = useState<ResultData | null>(null);
  const [replay, setReplay] = useState(false);
  useEffect(() => {
    setFinished(null);
    setReplay(false);
  }, [quizId]);

  if (loading) return <LoadingBlock label="Abrindo o quiz…" />;
  if (error) return <ErrorBlock error={error} />;
  if (!quiz) return <NotFound />;

  return (
    <>
      <Breadcrumb items={[{ label: 'Quizzes', to: '/quizzes' }, { label: quiz.title || 'Quiz' }]} />
      {quiz.status === 'gerando' && <Generating quiz={quiz} />}
      {quiz.status === 'erro' && <Failed quiz={quiz} />}
      {quiz.status === 'pronto' && (
        <>
          {quiz.noMaterial && !finished && !quiz.result && (
            <Alert variant="info" className="mx-auto mb-4 max-w-3xl">
              Gerado sem os seus materiais (tema livre): as questões não se baseiam nos seus arquivos.
            </Alert>
          )}
          {quiz.truncated && !finished && !quiz.result && (
            <Alert variant="info" className="mx-auto mb-4 max-w-3xl">
              O material é grande: a IA usou trechos espalhados por todo ele.
            </Alert>
          )}
          {finished ? (
            <QuizResults quiz={quiz} result={finished} />
          ) : quiz.result && !replay ? (
            <StoredResult quiz={quiz} onReplay={() => setReplay(true)} />
          ) : (
            <QuizPlayer quiz={quiz} onFinished={(r) => setFinished(r)} />
          )}
        </>
      )}
    </>
  );
}

/** Resultado salvo (ao reabrir um quiz já feito). */
function StoredResult({ quiz, onReplay }: { quiz: Quiz; onReplay: () => void }) {
  const uid = useUid();
  const resultId = quiz.result!.resultId;
  const result = useQuery({
    queryKey: ['quiz-result', uid, resultId],
    queryFn: async () => (await getDoc(doc(userCol(uid, 'quizResults'), resultId))).data() as ResultData | undefined,
  });
  if (result.isLoading) return <LoadingBlock />;
  if (!result.data) return <ErrorBlock error={new Error('Resultado não encontrado.')} />;
  return (
    <>
      <div className="mx-auto mb-3 flex max-w-3xl justify-end">
        <Button variant="ghost" size="sm" onClick={onReplay}>
          <RotateCcw className="size-4" /> Refazer este quiz
        </Button>
      </div>
      <QuizResults quiz={quiz} result={result.data} />
    </>
  );
}

function Generating({ quiz }: { quiz: Quiz }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => tick((n) => n + 1), 5000);
    return () => window.clearInterval(t);
  }, []);
  const started = quiz.createdAt?.toMillis?.() ?? Date.now();
  const slow = Date.now() - started > 4 * 60_000;

  return (
    <Card className="mx-auto flex max-w-xl flex-col items-center gap-4 py-12 text-center">
      <span className="relative grid size-16 place-items-center rounded-2xl bg-primary-soft text-primary-text">
        <Sparkles className="size-7" />
        <Loader2 className="absolute -right-2 -bottom-2 size-6 animate-spin rounded-full bg-surface text-primary-text" />
      </span>
      <div>
        <h1 className="text-lg font-semibold text-text">A IA está criando {quiz.config.count} questões…</h1>
        <p className="mt-1 text-sm text-text-muted">
          Lendo os materiais, escolhendo os pontos importantes e escrevendo gabarito comentado. Costuma levar de 30 segundos a 2 minutos.
        </p>
        <p className="mt-2 text-xs text-text-muted">Pode sair desta tela: o quiz fica salvo em “Meus quizzes”.</p>
      </div>
      {slow && (
        <Alert variant="warning" className="text-left">
          Está demorando mais do que o normal. Se não terminar, volte e gere de novo.
        </Alert>
      )}
      <ButtonLink to="/quizzes" variant="secondary">
        Ir para Meus quizzes
      </ButtonLink>
    </Card>
  );
}

function Failed({ quiz }: { quiz: Quiz }) {
  const [retry, setRetry] = useState(false);
  return (
    <Card className="mx-auto flex max-w-xl flex-col items-center gap-4 py-10 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-error/10 text-error">
        <AlertTriangle className="size-7" />
      </span>
      <div>
        <h1 className="text-lg font-semibold text-text">Não foi possível gerar o quiz</h1>
        <p className="mt-1 text-sm text-text-muted">{quiz.error ?? 'Tente de novo em instantes.'}</p>
        <p className="mt-1 text-xs text-text-muted">Este pedido não contou no seu limite diário.</p>
      </div>
      <Button onClick={() => setRetry(true)}>
        <RotateCcw className="size-4" /> Tentar de novo
      </Button>
      <QuizConfigModal open={retry} onClose={() => setRetry(false)} source={quiz.source} sourceLabel="Mesma origem do quiz anterior" initialConfig={quiz.config} />
    </Card>
  );
}
