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
  { title: "Primeiros passos", items: [
    ["Acesso e aprovação", "Crie sua conta com e-mail e senha. Contas novas ficam aguardando aprovação do administrador; enquanto isso nenhuma tela de dados abre. Após aprovado, todas as funções liberam."],
    ["Instalar no celular", "Abra o site no navegador do celular e use Adicionar à tela inicial. Depois toque no sino para ativar as notificações (gratuitas)."],
    ["Barra lateral", "As telas ficam agrupadas por seção (Prospecção, Automação, Vendas, Inteligência, Papa Lead). No celular, abra pelo botão de menu."],
    ["Versão teste (/teste)", "Uma página com o menu reorganizado em 4 grupos, para avaliar um painel mais simples sem mexer no atual."],
  ] },
  { title: "Prospecção", items: [
    ["Leads do dia", "Todo dia à meia-noite (horário de Rio Branco) o robô separa até 15 empresas sem site ou só com Instagram/WhatsApp. Ele aprende com você: empresas salvas e que avançaram no pipeline contam como bons exemplos; descartadas e perdidas, como ruins. Regenerar troca a lista e as substituídas nunca voltam. Nicho, estado e liga/desliga ficam nas configurações da tela."],
    ["Aprendizado", "Mostra o que o robô já aprendeu sobre o tipo de empresa que você prefere (nota, avaliações, presença na internet, nicho, palavras do nome)."],
    ["Buscar", "Pesquisa no Google Maps por nicho, cidade e estado, com nota, número de avaliações e situação do site (sem site, só rede social, com site). A contagem mostra quantas foram eliminadas por cada filtro. Selecione e salve em um bloco ou direto no pipeline."],
    ["Buscar loja específica", "Na mesma tela, escolha Loja específica e digite o nome (e a cidade, se quiser) para achar uma empresa exata, inclusive fora do Brasil."],
    ["Comparar", "Coloca lado a lado empresas do mesmo nicho (nota, avaliações, site) para você usar como argumento na abordagem. No celular aparece em cartões."],
    ["Leads externos", "Guarde leads achados fora do app (cadastro manual ou CSV) com o link de onde você os encontrou, sem misturar com o pipeline."],
    ["Scripts", "Modelos de abordagem com até 3 mensagens e marcadores como {nome}, {cidade}, {nicho}. O botão Teste envia o funil para o seu próprio número, com 10 s entre mensagens. O lead guarda qual script foi usado."],
  ] },
  { title: "Automação", items: [
    ["Bloco de leads", "Grupos de empresas (ex.: Clínicas Rio Branco) usados como público das campanhas. Salvar num bloco também coloca a empresa no pipeline, sem mudar o status de quem já existe."],
    ["Campanhas", "Criação em etapas: nome e número do WhatsApp; bloco e agenda (dias, horário, limite diário, intervalo); mensagens; revisão. O robô envia sozinho a cada 18 minutos. Se o cliente responde, as próximas mensagens do funil são canceladas e o lead vira Respondeu."],
    ["Agendamentos", "Envio programado para uma empresa só, fora de campanha. Mostra pendentes, enviados, cancelados e falhas com o motivo."],
    ["Métricas", "Total enviado, falhas e empresas por bloco, com gráfico."],
    ["WhatsApp", "Conecte números pelo QR Code, renomeie, veja se estão conectados e desconecte. Cada conta só vê os próprios números; números criados direto no servidor só aparecem para o administrador."],
  ] },
  { title: "Agentes (vendedores com IA)", items: [
    ["O que são", "Vendedores automáticos que mineram empresas, mandam a abordagem, conversam com o cliente seguindo suas regras e avisam quando alguém está quente. Você pode ter vários, cada um com sua função, e ligar ou desligar quando quiser."],
    ["Criar pelo Modo chat", "Descreva o agente com suas palavras (o que vende, para quem, como fala). Ele monta o rascunho sozinho; peça ajustes no chat e confira no formulário antes de salvar."],
    ["Criar pelo Formulário", "Preencha nome, missão, regras, ofertas, número de WhatsApp e IA (a nativa do painel ou uma chave própria do Ollama)."],
    ["Abrir painel", "Cada agente tem um painel só dele, com as abas abaixo."],
    ["Ao vivo", "O que ele está fazendo agora (minerando, abordando, respondendo), a fila das próximas abordagens e os números: abordados, responderam, quentes. Atualiza sozinho a cada poucos segundos."],
    ["Conversas", "Lista de clientes com toda a troca de mensagens. Você pode digitar e enviar direto dali. Ao enviar, a IA pausa naquele contato até você clicar em Devolver pra IA. Mensagens que você mandar pelo próprio celular também aparecem aqui e pausam a IA. As respostas do cliente são registradas mesmo com a IA desligada ou pausada."],
    ["Minerador próprio", "Busca empresas por nicho e cidade e guarda só na carteira do agente, sem misturar com seus leads. Dá para mover um lead para o seu pipeline ou passar um bloco seu para o agente trabalhar. Com o modo automático ligado, ele minera sozinho toda noite."],
    ["Roteiro e jeito", "Contexto do negócio, como falar (tom, gírias, tamanho das mensagens), ritmo de resposta (rápido, normal, calmo, ocupado) e as etapas do funil — a 1ª etapa é a mensagem de abordagem. Abordagens saem de segunda a sábado, das 8h às 18h."],
    ["Respostas humanas", "Ele espera um tempo antes de responder, junta várias mensagens seguidas do cliente numa resposta só e divide o texto em balões curtos, para não parecer robô."],
    ["Áudios", "Grave ou envie áudios e defina um gatilho (ex.: cliente pergunta o preço). Quando o gatilho bate, ele manda o áudio como se tivesse gravado na hora."],
    ["Estudar prints", "Envie prints das suas conversas de venda. A IA lê, aprende o seu jeito e guarda apenas o texto aprendido; a imagem não é armazenada."],
    ["Modo treinamento (administrador)", "Ligue o modo e converse com o agente pelo WhatsApp a partir do número de treino: dê ordens, corrija o jeito dele, pergunte o que o cliente X respondeu ou peça um resumo das conversas."],
    ["Clientes quentes", "Quando um cliente mostra interesse real, você recebe notificação no celular e uma mensagem no número de treino com o motivo."],
  ] },
  { title: "Inteligência e sistema", items: [
    ["Argos", "Assistente do painel com respostas curtas. Peça em texto (ex.: minere 20 clínicas em Rio Branco, crie uma campanha para o bloco X, quantos leads responderam hoje) e ele executa."],
    ["Sistema (só administrador)", "Mostra o uso e o limite do banco de dados, se o servidor do WhatsApp está no ar (horas grátis e dias para renovar) e o estado da IA. Permite trocar o servidor do WhatsApp e a chave da IA pelo próprio painel; tudo é testado antes de salvar."],
    ["Acess (só administrador)", "Aprova ou bloqueia contas novas e mostra o histórico de acessos. Você recebe notificação quando alguém se cadastra."],
    ["Notificações", "Avisos no celular quando um cliente responde, um lead fica quente, saem os leads do dia ou você fica muito tempo sem usar o painel (um lembrete por período parado)."],
  ] },
  { title: "Vendas", items: [
    ["Pipeline", "Quadro com o status de cada empresa: Novo, Mensagem enviada, Respondeu, Reunião, Fechado e Perdido. Arraste ou mude o status; perdidos ensinam o robô a evitar perfis parecidos."],
    ["CRM", "Histórico, anotações, script usado e conclusão com o link do site ou produto entregue."],
    ["Cotações", "Uma proposta por lead: valor, prazo e forma de pagamento."],
    ["Clientes", "Clientes fechados com valor recebido e custos do projeto. O ROI usa só o que foi realmente recebido menos os custos; sem custos não há porcentagem."],
  ] },
  { title: "Papa Lead (negócio separado)", items: [
    ["Contatos", "Extraia membros de grupos (administradores vêm desmarcados), importe CSV ou cole a lista. Marque não enviar para quem pediu para sair."],
    ["Mensagens", "Blocos com até 3 mensagens e variações sorteadas para cada contato, para os textos não saírem iguais."],
    ["Campanhas", "Ordem aleatória, limite diário, intervalos e janela de horário. Mostra quantas chegaram, quantas responderam e um termômetro de risco. Use Atualizar para ver dados novos e Começar agora para antecipar. Os dados nunca se misturam com o BatRadar."],
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
