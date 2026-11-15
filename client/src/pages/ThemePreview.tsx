import { ArrowLeft, BookMarked, FolderOpen, Gavel, Scale, Upload } from 'lucide-react';
import { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { toast } from 'sonner';
import { axisProps, chartColors, gridProps, tooltipProps } from '@/components/charts/chartTheme';
import { FolderCard } from '@/components/materials/FolderCard';
import { ThemeSelector } from '@/components/theme/ThemeSelector';
import { Alert } from '@/components/ui/Alert';
import { Badge, SoonBadge } from '@/components/ui/Badge';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card, CardDescription, CardTitle } from '@/components/ui/Card';
import { EmptyState, Spinner } from '@/components/ui/Feedback';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { cn } from '@/lib/cn';

/**
 * PÁGINA TEMPORÁRIA — /tema-preview
 * Mostra os componentes nos dois temas lado a lado. Pode ser removida depois.
 */
export default function ThemePreview() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="min-h-dvh bg-bg">
      <header className="sticky top-0 z-30 border-b border-border bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
          <ButtonLink to="/" variant="ghost" size="sm">
            <ArrowLeft className="size-4" /> Voltar
          </ButtonLink>
          <h1 className="font-semibold text-text">Prévia do tema</h1>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setModalOpen(true)}>
              Abrir modal real
            </Button>
            <Button variant="secondary" size="sm" onClick={() => toast.success('Questão registrada!')}>
              Toast sucesso
            </Button>
            <Button variant="secondary" size="sm" onClick={() => toast.error('Não foi possível salvar.')}>
              Toast erro
            </Button>
            <ThemeSelector />
          </div>
        </div>
      </header>

      <p className="mx-auto max-w-7xl px-4 pt-5 text-sm text-text-muted">
        Os dois painéis abaixo forçam cada tema. O topo, o modal real e os toasts seguem o tema escolhido no seletor.
      </p>

      <div className="mx-auto grid max-w-7xl gap-6 p-4 lg:grid-cols-2">
        <ThemePane theme="light" title="Modo claro — roxo e branco" />
        <ThemePane theme="dark" title="Modo escuro — escuro e rosa" />
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Registrar no caderno de erros"
        description="Por que você errou esta questão?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => setModalOpen(false)}>Salvar</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Categoria">
            {(id) => (
              <Select id={id} defaultValue="Confundiu conceitos">
                <option>Não conhecia o conteúdo</option>
                <option>Confundiu conceitos</option>
                <option>Errou por desatenção</option>
              </Select>
            )}
          </Field>
          <Field label="Anotação">{(id) => <Textarea id={id} placeholder="O que eu preciso lembrar…" />}</Field>
        </div>
      </Modal>
    </div>
  );
}

const chartData = [
  { dia: 'Seg', questoes: 12, acertos: 9 },
  { dia: 'Ter', questoes: 20, acertos: 14 },
  { dia: 'Qua', questoes: 8, acertos: 7 },
  { dia: 'Qui', questoes: 25, acertos: 19 },
  { dia: 'Sex', questoes: 16, acertos: 13 },
  { dia: 'Sáb', questoes: 30, acertos: 24 },
  { dia: 'Dom', questoes: 10, acertos: 8 },
];

function ThemePane({ theme, title }: { theme: 'light' | 'dark'; title: string }) {
  return (
    <section className={cn(theme, 'space-y-6 rounded-2xl border border-border bg-bg p-5 text-text')}>
      <h2 className="text-lg font-bold">{title}</h2>

      {/* Tipografia */}
      <div className="space-y-1">
        <p className="text-text">Texto principal — Direito Constitucional, art. 5º.</p>
        <p className="text-sm text-text-muted">Texto secundário — atualizado há 2 horas.</p>
        <a href="#" onClick={(e) => e.preventDefault()} className="text-sm font-medium text-primary-text hover:underline">
          Link na cor principal
        </a>
      </div>

      {/* Botões */}
      <Group label="Botões">
        <div className="flex flex-wrap gap-2">
          <Button>Primário</Button>
          <Button variant="secondary">Secundário</Button>
          <Button variant="ghost">Fantasma</Button>
          <Button variant="danger">Excluir</Button>
          <Button loading>Salvando</Button>
          <Button disabled>Desabilitado</Button>
          <Button variant="secondary" size="icon" aria-label="Enviar">
            <Upload className="size-4" />
          </Button>
        </div>
      </Group>

      {/* Inputs */}
      <Group label="Campos">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nome da pasta">{(id) => <Input id={id} placeholder="Ex.: Súmulas do STJ" />}</Field>
          <Field label="Tipo de projeto">
            {(id) => (
              <Select id={id} defaultValue="oab">
                <option value="faculdade">Faculdade</option>
                <option value="oab">OAB</option>
                <option value="concurso">Concurso</option>
              </Select>
            )}
          </Field>
          <Field label="E-mail" error="Informe um e-mail válido.">
            {(id, d) => <Input id={id} aria-invalid aria-describedby={d} defaultValue="tayna@" />}
          </Field>
          <Field label="Data da prova" hint="Use o calendário do navegador.">
            {(id, d) => <Input id={id} type="date" aria-describedby={d} />}
          </Field>
        </div>
      </Group>

      {/* Badges */}
      <Group label="Badges">
        <div className="flex flex-wrap gap-2">
          <Badge variant="primary">Direito Civil</Badge>
          <Badge>Rascunho</Badge>
          <Badge variant="success">Acertou</Badge>
          <Badge variant="error">Errou</Badge>
          <Badge variant="warning">Revisar</Badge>
          <Badge variant="info">Novo</Badge>
          <SoonBadge />
        </div>
      </Group>

      {/* Alertas */}
      <Group label="Alertas">
        <div className="space-y-2">
          <Alert variant="success" title="Resposta correta">
            Alternativa C, conforme o art. 186 do Código Civil.
          </Alert>
          <Alert variant="error" title="Resposta incorreta">
            Revise a diferença entre prescrição e decadência.
          </Alert>
          <Alert variant="warning" title="Atenção">
            Você tem 4 erros não resolvidos nesta matéria.
          </Alert>
          <Alert variant="info" title="Dica">
            Arraste arquivos para cá para enviá-los.
          </Alert>
        </div>
      </Group>

      {/* Cards */}
      <Group label="Cards">
        <div className="grid gap-3 sm:grid-cols-2">
          <Card>
            <CardDescription>Acertos nesta semana</CardDescription>
            <p className="mt-1 text-3xl font-bold text-text">78%</p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-primary-soft">
              <div className="h-full w-[78%] rounded-full bg-primary" />
            </div>
          </Card>
          <Card className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary-text">
              <Scale className="size-5" />
            </span>
            <div>
              <CardTitle>Exame da OAB</CardTitle>
              <CardDescription>6 matérias · 42 materiais</CardDescription>
            </div>
          </Card>
        </div>
      </Group>

      {/* Gráficos */}
      <Group label="Gráficos (Recharts)">
        <Card className="space-y-4 p-4">
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="dia" {...axisProps} />
                <YAxis {...axisProps} width={28} />
                <Tooltip {...tooltipProps} />
                <Bar dataKey="questoes" name="Questões" fill={chartColors.primary} radius={[6, 6, 0, 0]} />
                <Bar dataKey="acertos" name="Acertos" fill={chartColors.series[2]} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="dia" {...axisProps} />
                <YAxis {...axisProps} width={28} />
                <Tooltip {...tooltipProps} cursor={{ stroke: 'var(--border)' }} />
                <Line
                  type="monotone"
                  dataKey="acertos"
                  name="Acertos"
                  stroke={chartColors.primary}
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: chartColors.primary }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </Group>

      {/* Pastas */}
      <Group label="Pastas (cor do usuário, igual nos dois temas)">
        <div className="grid gap-3 sm:grid-cols-3">
          <FolderCard name="Súmulas" color="#7C3AED" icon={Gavel} itemCount={12} />
          <FolderCard name="Resumos" color="#EAB308" icon={BookMarked} itemCount={1} />
          <FolderCard name="Provas antigas" color="#64748B" itemCount={8} />
        </div>
      </Group>

      {/* Modal (estático, para comparar) */}
      <Group label="Modal">
        <div className="rounded-2xl border border-border bg-surface-elevated shadow-card">
          <div className="p-5 pb-3">
            <p className="text-lg font-semibold text-text">Excluir pasta “Súmulas”?</p>
            <p className="mt-1 text-sm text-text-muted">A pasta tem 12 itens. O que fazer com o conteúdo?</p>
          </div>
          <div className="flex flex-wrap justify-end gap-2 border-t border-border p-4">
            <Button variant="secondary">Mover para a pasta acima</Button>
            <Button variant="danger">Excluir tudo</Button>
          </div>
        </div>
      </Group>

      {/* Estado vazio e loading */}
      <Group label="Estado vazio e carregamento">
        <Card className="p-0">
          <EmptyState
            icon={FolderOpen}
            title="Nenhum material ainda"
            description="Crie uma pasta ou envie seus PDFs, slides e anotações."
            action={<Button>Criar primeira pasta</Button>}
          />
        </Card>
        <div className="mt-3 flex items-center gap-2 text-sm text-text-muted">
          <Spinner /> Carregando materiais…
        </div>
      </Group>
    </section>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2.5">
      <h3 className="text-xs font-semibold tracking-wide text-text-muted uppercase">{label}</h3>
      {children}
    </div>
  );
}
