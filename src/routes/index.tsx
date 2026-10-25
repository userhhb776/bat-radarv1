import { createFileRoute, Link } from "@tanstack/react-router";
import { Search, Radar, Layers, Send, KanbanSquare, Brain, BellRing, ArrowRight, Check, MapPin, Star, GlobeLock } from "lucide-react";
import { Button } from "@/components/ui/button";
import logo from "@/assets/batradar-logo.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BatRadar 5.7 — Ache empresas sem site e feche mais vendas" },
      { name: "description", content: "Encontre empresas locais sem site no Google Maps, organize em blocos e aborde no WhatsApp com campanhas automáticas e funil de vendas." },
      { property: "og:title", content: "BatRadar 5.7 — Ache empresas sem site e feche mais vendas" },
      { property: "og:description", content: "Prospecção local: busca no Google Maps, leads do dia, campanhas no WhatsApp e pipeline de vendas em um só painel." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const steps = [
  { icon: Search, t: "Encontre", d: "Busque por nicho, cidade e estado. Veja quem não tem site ou usa só Instagram e WhatsApp." },
  { icon: Layers, t: "Organize", d: "Salve as melhores em blocos. Tudo entra no Pipeline automaticamente." },
  { icon: Send, t: "Aborde", d: "Campanhas no WhatsApp com até 3 mensagens, variações e horários seguros." },
  { icon: KanbanSquare, t: "Feche", d: "Acompanhe cada empresa até o contrato, com proposta e resultado." },
];

const features = [
  { icon: Radar, t: "Leads do dia", d: "Toda meia-noite, 15 empresas novas esperando por você." },
  { icon: Brain, t: "Aprende com você", d: "Entende o perfil das empresas que você salva, descarta e fecha." },
  { icon: Send, t: "Campanhas no WhatsApp", d: "Funil, limites diários, AM/PM e risco de bloqueio na tela." },
  { icon: BellRing, t: "Notificações", d: "Saiba quando uma mensagem sai ou falha, sem abrir o painel." },
  { icon: KanbanSquare, t: "Pipeline e CRM", d: "Do primeiro contato à reunião e ao fechamento." },
  { icon: Layers, t: "Blocos de leads", d: "Segmente por nicho e dispare só para quem importa." },
];

const sample = [
  { n: "Boutique Aurora", c: "Rio Branco · AC", r: 4.8, v: 212 },
  { n: "Ateliê Kids", c: "Vitória · ES", r: 4.6, v: 98 },
  { n: "Moda Vila", c: "Campinas · SP", r: 4.7, v: 154 },
];

function Landing() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-ink text-ink-foreground">
      <header className="sticky top-0 z-20 border-b border-ink-foreground/10 bg-ink/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-2 font-display text-lg font-semibold tracking-wide">
            <img src={logo} alt="" width={1024} height={1024} className="h-8 w-8 object-contain" /> BatRadar 5.7
          </div>
          <Button asChild size="sm" variant="outline"><Link to="/auth">Entrar / Criar conta</Link></Button>
        </div>
      </header>

      <section className="relative">
        <div className="pointer-events-none absolute inset-0 bg-grid [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-14 text-center md:grid-cols-2 md:pt-24 md:text-left">
          <div className="animate-rise">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Prospecção local
            </span>
            <h1 className="mt-5 font-display text-4xl font-bold uppercase leading-[1.05] sm:text-5xl md:text-6xl">
              Ache quem precisa de site. <span className="text-primary">Feche antes dos outros.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-lg text-base text-ink-foreground/70 sm:text-lg md:mx-0">
              O BatRadar encontra empresas sem site no Google Maps, organiza seus leads e faz a abordagem no WhatsApp por você.
            </p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center md:justify-start">
              <Button asChild size="lg" className="glow-primary w-full sm:w-auto"><Link to="/buscar">Começar a prospectar <ArrowRight className="h-4 w-4" /></Link></Button>
              <Button asChild size="lg" variant="ghost" className="w-full sm:w-auto"><a href="#como-funciona">Como funciona</a></Button>
            </div>
            <ul className="mt-8 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-ink-foreground/60 md:justify-start">
              {["Sem site primeiro", "Envios em horário seguro", "Funil de vendas"].map((t) => (
                <li key={t} className="flex items-center gap-1.5"><Check className="h-4 w-4 text-primary" />{t}</li>
              ))}
            </ul>
          </div>

          <div className="animate-rise relative mx-auto w-full max-w-md [animation-delay:150ms]">
            <div className="relative mx-auto aspect-square w-56 sm:w-64">
              <div className="absolute inset-0 rounded-full border border-primary/25" />
              <div className="absolute inset-8 rounded-full border border-primary/20" />
              <div className="absolute inset-16 rounded-full border border-primary/15" />
              <div className="animate-radar absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,transparent_0deg,color-mix(in_oklab,var(--primary)_35%,transparent)_50deg,transparent_60deg)]" />
              {[["top-[22%] left-[64%]", "0s"], ["top-[60%] left-[25%]", "0.8s"], ["top-[70%] left-[70%]", "1.6s"]].map(([p, d]) => (
                <span key={p} className={`absolute ${p} h-2.5 w-2.5`}>
                  <span className="animate-ping-soft absolute inset-0 rounded-full bg-primary" style={{ animationDelay: d }} />
                  <span className="absolute inset-0 rounded-full bg-primary" />
                </span>
              ))}
              <img src={logo} alt="" width={1024} height={1024} className="absolute inset-[38%] object-contain" />
            </div>
            <div className="mt-6 space-y-2 text-left">
              {sample.map((s, i) => (
                <div key={s.n} className="animate-rise flex items-center gap-3 rounded-lg border border-ink-foreground/10 bg-ink-foreground/[0.04] p-3 backdrop-blur" style={{ animationDelay: `${300 + i * 120}ms` }}>
                  <MapPin className="h-4 w-4 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{s.n}</p>
                    <p className="flex items-center gap-1 text-xs text-ink-foreground/60"><Star className="h-3 w-3 fill-warm text-warm" />{s.r} · {s.v} avaliações · {s.c}</p>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded bg-hot/15 px-2 py-0.5 text-[11px] font-medium text-hot"><GlobeLock className="h-3 w-3" />sem site</span>
                </div>
              ))}
              <p className="text-center text-[11px] text-ink-foreground/40">Exemplo ilustrativo</p>
            </div>
          </div>
        </div>
      </section>

      <section id="como-funciona" className="border-y border-ink-foreground/10 bg-ink-foreground/[0.02]">
        <div className="mx-auto max-w-6xl px-5 py-20 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Como funciona</p>
          <h2 className="mt-3 font-display text-3xl font-bold uppercase sm:text-4xl">Do mapa ao contrato em 4 passos</h2>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((s, i) => (
              <div key={s.t} className="group relative rounded-xl border border-ink-foreground/10 p-6 text-center transition hover:-translate-y-1 hover:border-primary/40 sm:text-left">
                <span className="absolute right-4 top-3 font-display text-4xl font-bold text-ink-foreground/5 transition group-hover:text-primary/20">0{i + 1}</span>
                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 sm:mx-0"><s.icon className="h-5 w-5 text-primary" /></div>
                <h3 className="mt-4 text-lg font-semibold">{s.t}</h3>
                <p className="mt-1 text-sm text-ink-foreground/60">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-20 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">Tudo em um painel</p>
        <h2 className="mt-3 font-display text-3xl font-bold uppercase sm:text-4xl">Feito para quem vende site</h2>
        <div className="mt-12 grid gap-px overflow-hidden rounded-xl border border-ink-foreground/10 bg-ink-foreground/10 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.t} className="bg-ink p-6 text-center transition hover:bg-ink-foreground/[0.04] sm:text-left">
              <f.icon className="mx-auto h-5 w-5 text-primary sm:mx-0" />
              <h3 className="mt-3 font-semibold">{f.t}</h3>
              <p className="mt-1 text-sm text-ink-foreground/60">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-5 pb-24">
        <div className="relative mx-auto max-w-4xl overflow-hidden rounded-2xl border border-primary/30 bg-primary/[0.06] px-6 py-14 text-center">
          <div className="pointer-events-none absolute inset-0 bg-grid opacity-60" />
          <h2 className="relative font-display text-3xl font-bold uppercase sm:text-4xl">Seu próximo cliente já está no mapa</h2>
          <p className="relative mx-auto mt-3 max-w-md text-ink-foreground/70">Entre e veja as empresas de hoje esperando a sua mensagem.</p>
          <Button asChild size="lg" className="glow-primary relative mt-8 w-full sm:w-auto"><Link to="/buscar">Abrir o painel <ArrowRight className="h-4 w-4" /></Link></Button>
        </div>
      </section>

      <footer className="border-t border-ink-foreground/10 py-8 text-center text-xs text-ink-foreground/40">
        BatRadar 5.7 · criado por Lucas
      </footer>
    </div>
  );
}
