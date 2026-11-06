import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Brain, MessageCircle, Target, GraduationCap, ShieldCheck, Sparkles } from "lucide-react";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated/agentes-v2")({
  head: () => ({ meta: [
    { title: "Agentes V2 — BatRadar" },
    { name: "description", content: "Nova geração de agentes conversacionais BatRadar." },
  ] }),
  component: Page,
});

const capabilities = [
  { icon: MessageCircle, title: "Conversas completas", description: "Conduzir diálogos com contexto, em vez de apenas enviar abordagens e respostas isoladas." },
  { icon: Target, title: "Identificação de oportunidades", description: "Reconhecer sinais de interesse, qualificar leads e separar curiosos de potenciais clientes." },
  { icon: GraduationCap, title: "Aprendizado com feedback", description: "Analisar erros e correções para melhorar o comportamento com aprovação e regras controladas." },
  { icon: ShieldCheck, title: "Controle e segurança", description: "Respeitar limites, regras comerciais, transferência para atendimento humano e histórico de decisões." },
];

function Page() {
  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-6 p-4">
        <Link to="/agentes" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Voltar para Agentes
        </Link>
        <section className="relative overflow-hidden rounded-2xl border bg-card p-6 sm:p-8">
          <div className="absolute right-5 top-5 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-500">EM DESENVOLVIMENTO</div>
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Brain className="h-7 w-7" /></div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">BatRadar · Nova geração</p>
          <h1 className="mt-2 text-3xl font-bold">Agentes V2</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">Uma nova linha de agentes que vai além da abordagem inicial: conversa com o cliente, entende o contexto, identifica oportunidades e evolui com base nos resultados e nas correções recebidas.</p>
          <div className="mt-5 flex items-center gap-2 text-sm text-amber-500"><Sparkles className="h-4 w-4" /> Área experimental — recursos ainda não estão ativos</div>
        </section>
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">O que estamos planejando</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {capabilities.map((item) => <article key={item.title} className="rounded-xl border bg-card p-4">
              <item.icon className="mb-3 h-5 w-5 text-primary" />
              <h3 className="font-semibold">{item.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
            </article>)}
          </div>
        </section>
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Os Agentes atuais continuam funcionando normalmente. Esta área é apenas a base visual e organizacional da V2; nenhuma automação nova, aprendizado autônomo ou envio de mensagens foi ativado aqui.</p>
      </div>
    </AppShell>
  );
}
