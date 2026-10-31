import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated/manual")({
  head: () => ({ meta: [
    { title: "Manual — BatRadar 5.7" }, { name: "description", content: "Guia do usuário do BatRadar e Papa Lead: funções, recomendações e termos de uso." },
    { property: "og:title", content: "Manual — BatRadar 5.7" }, { property: "og:description", content: "Guia do usuário do BatRadar e Papa Lead: funções, recomendações e termos de uso." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: Page,
});

const sections: { title: string; items: [string, string][] }[] = [
  { title: "Prospecção", items: [
    ["Leads do dia", "Todo dia à meia-noite (horário de Rio Branco) o robô separa até 15 empresas sem site ou só com Instagram/WhatsApp, parecidas com as que avançaram no seu pipeline. Use o botão de regenerar para trocar a lista e os filtros de nicho e estado para direcionar a busca."],
    ["Buscar", "Pesquisa empresas no Google Maps por nicho, cidade e estado, com nota, avaliações e situação do site. A contagem mostra quantas foram eliminadas por cada filtro."],
    ["Comparar", "Coloca lado a lado empresas do mesmo nicho para você ver quem está à frente."],
    ["Leads externos", "Organiza leads achados fora do app (CSV ou cadastro manual), sem misturar com o pipeline."],
    ["Scripts", "Modelos de abordagem com até 3 mensagens e marcadores como {nome}. O botão Teste envia o funil para o seu próprio número, com 10 s entre mensagens."],
  ] },
  { title: "Automação", items: [
    ["Bloco de leads", "Reúna empresas do mesmo nicho para usar numa campanha."],
    ["Campanhas", "Criação em etapas: nome e número, público e agenda, mensagens e revisão. Use a configuração recomendada para reduzir riscos."],
    ["Agendamentos", "Envios programados para uma empresa só, fora de campanha."],
    ["Métricas", "Total enviado, falhas e empresas por bloco, com gráfico."],
    ["WhatsApp", "Conecte e renomeie seus números pelo QR Code."],
    ["Agentes", "Vendedores automáticos: mineram empresas, mandam a abordagem e conversam com os clientes seguindo suas regras. Crie em Modo chat (você descreve o que quer e ele se monta sozinho) ou pelo Formulário. Escolha o número, a IA (nativa ou chave própria do Ollama) e ligue ou desligue quando quiser. Em «Abrir painel» cada agente tem seu próprio painel: Ao vivo (o que ele está fazendo e a fila de abordagens), Conversas (você lê e responde direto; ao responder a IA pausa naquela conversa até você devolver), Minerador próprio (empresas ficam só com ele; dá pra mover para seus leads ou passar um bloco seu pra ele), Roteiro e jeito (contexto, como falar, tempo de resposta e etapas — a 1ª é a abordagem), Áudios (enviados como áudio gravado na hora quando o gatilho bate) e Estudar prints (ele aprende com prints das suas conversas e a imagem não é guardada). O administrador também pode treinar pelo WhatsApp no modo treinamento."],
  ] },
  { title: "Inteligência e sistema", items: [
    ["Argos", "Assistente do painel. Peça em texto (ex.: \"minere 20 clínicas em Rio Branco\") e ele executa: busca, cria blocos, campanhas e mostra resumos."],
    ["Buscar loja específica", "Na tela Buscar, use \"Loja específica\" para achar uma empresa pelo nome, inclusive fora do Brasil."],
    ["Sistema (só administrador)", "Mostra o uso do banco, o servidor do WhatsApp (horas grátis e dias para renovar) e a IA. Dá para trocar o servidor e a chave da IA pelo próprio painel; o painel testa antes de salvar."],
  ] },
  { title: "Vendas", items: [
    ["Pipeline", "Status de cada empresa: Novo, Mensagem enviada, Respondeu, Reunião, Fechado e Perdido."],
    ["CRM", "Histórico, anotações e conclusão com o link do site entregue."],
    ["Cotações", "Valor, prazo e forma de pagamento. O ROI considera apenas o valor recebido menos os custos."],
  ] },
  { title: "Papa Lead (negócio separado)", items: [
    ["Contatos", "Extraia membros de grupos (administradores vêm desmarcados), importe CSV ou cole a lista. Marque “não enviar” para quem pediu para sair."],
    ["Mensagens", "Blocos com até 3 mensagens e variações sorteadas para cada contato, para os textos não saírem iguais."],
    ["Campanhas", "Ordem aleatória, limite diário, intervalos e janela de horário. Mostra quantas chegaram, quantas responderam (você marca) e um termômetro de risco. Use Atualizar para ver dados novos e Começar agora para antecipar."],
  ] },
];

const tips = [
  "Use números antigos e com histórico de conversas.",
  "Até 15 contatos por dia, com 40–120 min de intervalo, em horário comercial e dias úteis.",
  "Crie variações em todas as mensagens e cite a origem do contato (ex.: o grupo).",
  "Não insista com quem não respondeu e remova quem pedir para sair.",
  "No plano gratuito o servidor do WhatsApp dorme e pode atrasar ou falhar o primeiro envio; o plano pago básico resolve.",
  "Notificações no celular são gratuitas: ative o sino depois de instalar o app.",
  "O robô de envio confere a fila a cada 18 minutos: um envio pode sair até 18 min depois do horário marcado.",
  "Sempre publique depois de mudanças para valerem no app instalado.",
];

const terms = [
  "O uso do WhatsApp por automação não é oficial e pode levar a restrições ou banimento do número. A responsabilidade pelo uso é do usuário.",
  "Envie apenas para contatos com relação legítima com você e respeite a LGPD: informe a origem do contato e atenda pedidos de remoção.",
  "É proibido usar o painel para spam, golpes, conteúdo enganoso ou ofensivo.",
  "Os dados exibidos vêm do Google Maps e de fontes públicas; confira antes de usar. A IA não inventa dados.",
  "Contas são pessoais; não compartilhe sua senha.",
];

function Page() {
  return (
    <AppShell>
      <p className="text-xs font-semibold uppercase text-primary">Ajuda</p>
      <h1 className="text-3xl font-bold">Manual do usuário</h1>
      <p className="mt-1 text-sm text-muted-foreground">Como funciona cada parte do BatRadar 5.7 e do Papa Lead.</p>
      <div className="mt-6 grid gap-6">
        <section className="rounded-lg border bg-card p-5">
          <h2 className="font-semibold">Sobre</h2>
          <p className="mt-2 text-sm text-muted-foreground">O BatRadar 5.7 foi idealizado e criado por <b className="text-foreground">Lucas</b> para encontrar empresas sem site, organizar a abordagem e acompanhar vendas. O Papa Lead é um negócio separado, com contatos, mensagens e campanhas próprios.</p>
        </section>
        {sections.map((s) => (
          <section key={s.title} className="rounded-lg border bg-card p-5">
            <h2 className="font-semibold">{s.title}</h2>
            <dl className="mt-3 grid gap-3">{s.items.map(([k, v]) => <div key={k}><dt className="text-sm font-semibold text-primary">{k}</dt><dd className="text-sm text-muted-foreground">{v}</dd></div>)}</dl>
          </section>
        ))}
        <section className="rounded-lg border bg-card p-5"><h2 className="font-semibold">Recomendações</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">{tips.map((t) => <li key={t}>{t}</li>)}</ul></section>
        <section className="rounded-lg border bg-card p-5"><h2 className="font-semibold">Termos de uso</h2>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">{terms.map((t) => <li key={t}>{t}</li>)}</ol></section>
      </div>
    </AppShell>
  );
}
