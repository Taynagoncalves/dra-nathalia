import { ExternalLink } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { QuestionBank } from '@/components/questions/QuestionBank';
import { buttonClass } from '@/components/ui/Button';
import { QCONCURSOS_URL } from '@/lib/boards';

export default function QuestionsPage() {
  return (
    <>
      <PageHeader
        title="Questões"
        description="Seu banco de questões: crie, filtre, resolva e refaça só as que errou."
        actions={
          <a href={QCONCURSOS_URL} target="_blank" rel="noopener noreferrer" className={buttonClass('secondary')}>
            <ExternalLink className="size-4" /> Abrir o QConcursos
          </a>
        }
      />
      <QuestionBank />
    </>
  );
}
