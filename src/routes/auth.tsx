import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import logo from "@/assets/batradar-logo.png";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — BatRadar 5.7" },
      { name: "description", content: "Entre ou solicite uma conta no BatRadar 5.7, com aprovação de acesso." },
      { property: "og:title", content: "Entrar — BatRadar 5.7" },
      { property: "og:description", content: "Acesse sua plataforma de prospecção local." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [confirmation, setConfirmation] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/inicio", replace: true });
    });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { name: name.trim() } } });
        if (error) throw error;
        if (data.session) { navigate({ to: "/inicio", replace: true }); return; }
        setConfirmation(true);
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      await supabase.rpc("record_access", { _kind: "login", _page: "/auth" });
      navigate({ to: "/inicio", replace: true });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-lg bg-card p-5 shadow-xl sm:p-8">
        <div className="flex items-center gap-2 font-display text-lg font-semibold">
          <img src={logo} alt="" width={1024} height={1024} className="h-9 w-9 object-contain" /> BatRadar 5.7
        </div>
        <h1 className="mt-6 text-2xl font-bold">{mode === "signup" ? "Solicitar acesso" : "Entrar"}</h1>
        <Tabs value={mode} onValueChange={value => { setMode(value); setConfirmation(false); }} className="mt-4"><TabsList className="w-full"><TabsTrigger value="login" className="flex-1">Entrar</TabsTrigger><TabsTrigger value="signup" className="flex-1">Criar conta</TabsTrigger></TabsList></Tabs>
        {confirmation ? <div className="mt-6 space-y-3"><p className="text-sm">Conta criada. Entre com seu e-mail e senha para acompanhar a aprovação.</p><Button type="button" className="w-full" onClick={() => { setMode("login"); setConfirmation(false); }}>Voltar para entrar</Button></div> : <>
        <div className="mt-6 space-y-4">
          {mode === "signup" && <div className="space-y-1.5"><Label htmlFor="name">Nome</Label><Input id="name" autoComplete="name" required minLength={2} maxLength={120} value={name} onChange={e => setName(e.target.value)} /></div>}
          <div className="space-y-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Senha</Label>
            <Input id="password" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} required minLength={mode === "signup" ? 8 : 6} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Aguarde…" : mode === "signup" ? "Criar conta e solicitar aprovação" : "Entrar"}
          </Button>
        </div>
        </>}
      </form>
    </div>
  );
}
