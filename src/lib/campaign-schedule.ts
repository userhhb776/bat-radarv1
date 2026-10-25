// Calcula o horário de início de cada empresa respeitando janela, dias da semana e limite diário.
export type SchedCfg = { fromH: number; toH: number; days: number[]; dailyLimit: number; msgGap: number; minGap: number; maxGap: number };

export function planCompanyTimes(count: number, msgsPerCompany: number, cfg: SchedCfg, startMs: number, ignoreWindow = false): number[] {
  const fit = (t: number) => {
    if (ignoreWindow) return t;
    const d = new Date(t);
    for (let k = 0; k < 400; k++) {
      const mins = d.getHours() * 60 + d.getMinutes();
      if (cfg.days.includes(d.getDay()) && mins >= cfg.fromH * 60 && mins < cfg.toH * 60) return d.getTime();
      if (cfg.days.includes(d.getDay()) && mins < cfg.fromH * 60) { d.setHours(cfg.fromH, 0, 0, 0); continue; }
      d.setDate(d.getDate() + 1); d.setHours(cfg.fromH, 0, 0, 0);
    }
    return d.getTime();
  };
  let at = fit(startMs);
  const perDay = new Map<string, number>();
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    at = fit(at);
    if (cfg.dailyLimit > 0 && !ignoreWindow) {
      while ((perDay.get(new Date(at).toDateString()) ?? 0) >= cfg.dailyLimit) { const d = new Date(at); d.setDate(d.getDate() + 1); d.setHours(cfg.fromH, 0, 0, 0); at = fit(d.getTime()); }
    }
    const day = new Date(at).toDateString(); perDay.set(day, (perDay.get(day) ?? 0) + 1);
    out.push(at);
    at += (msgsPerCompany - 1) * cfg.msgGap * 1000 + (cfg.minGap + Math.random() * Math.max(0, cfg.maxGap - cfg.minGap)) * 1000;
  }
  return out;
}
