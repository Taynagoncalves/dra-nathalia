import { Play } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ButtonLink, Button } from '@/components/ui/Button';
import { Field, Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { STUDY_ACTIVITIES, useStudyTimer } from '@/contexts/StudyTimerContext';
import { useAllSubjects, useProjects } from '@/hooks/useStudyData';

export function StartTimerModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const timer = useStudyTimer();
  const subjects = useAllSubjects();
  const projects = useProjects();
  const [subjectId, setSubjectId] = useState('');
  const [activity, setActivity] = useState<string>('Leitura');

  // Projetos ativos, cada um com suas matérias (agrupadas no <select>).
  const groups = (projects.data ?? [])
    .filter((p) => !p.archived)
    .map((p) => ({ project: p, subjects: (subjects.data ?? []).filter((s) => s.projectId === p.id) }))
    .filter((g) => g.subjects.length > 0);

  useEffect(() => {
    if (open && !subjectId) setSubjectId(groups[0]?.subjects[0]?.id ?? '');
  }, [open, subjectId, groups]);

  const loading = subjects.isLoading || projects.isLoading;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Começar a estudar"
      description="O tempo fica salvo na matéria e conta para a sua sequência de dias."
      size="sm"
      footer={
        groups.length > 0 && (
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              disabled={!subjectId}
              onClick={() => {
                timer.start(subjectId, activity);
                onClose();
              }}
            >
              <Play className="size-4" /> Iniciar
            </Button>
          </>
        )
      }
    >
      {loading ? (
        <p className="text-sm text-text-muted">Carregando matérias…</p>
      ) : groups.length === 0 ? (
        <div className="space-y-4 text-sm text-text-muted">
          <p>Você ainda não tem matérias. Crie um projeto e adicione uma matéria para usar o timer.</p>
          <ButtonLink to="/projetos" onClick={onClose}>
            Ir para Projetos
          </ButtonLink>
        </div>
      ) : (
        <div className="space-y-4">
          <Field label="Matéria">
            {(id) => (
              <Select id={id} value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
                {groups.map((g) => (
                  <optgroup key={g.project.id} label={g.project.name}>
                    {g.subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Atividade">
            {(id) => (
              <Select id={id} value={activity} onChange={(e) => setActivity(e.target.value)}>
                {STUDY_ACTIVITIES.map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </Select>
            )}
          </Field>
        </div>
      )}
    </Modal>
  );
}
