import { PageHeader } from '@/components/layout/PageHeader';
import { QuestionBank } from '@/components/questions/QuestionBank';

export default function QuestionsPage() {
  return (
    <>
      <PageHeader
        title="Questões"
        description="Seu banco de questões: crie, filtre, resolva e refaça só as que errou."
      />
      <QuestionBank />
    </>
  );
}
