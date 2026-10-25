<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Enforce account approval through restrictive RLS and application middleware; the root account boundary is presentation only, so pending accounts cannot bypass it.
- Store account display fields and approval in profiles, roles in user_roles, and append-only activity in access_events; roles and approval are server-managed to prevent self-escalation.
- Pending profile inserts persist admin notifications and call a cron-token-protected push hook through pg_net; signup alerts must not depend on an open browser or client callbacks.
- Preserve existing accounts as approved during the approval-system backfill; new auth accounts get pending profiles through the lifecycle trigger to avoid blocking existing campaigns.
- Present competitor results as compact cards below the desktop table breakpoint; the full-width comparison table is not usable on phones.
- Keep proposals attached to saved leads with one proposal per lead and owner-scoped access; this prevents quotes and closed-client financials from crossing accounts.
- Compute displayed ROI from actual received amounts and recorded project costs only; quoted amounts are not revenue and zero costs have no meaningful percentage.
- Approach scripts are owner-scoped templates filled client-side with {variable} placeholders from lead data; leads keep the chosen script_id so the CRM shows which script was used.
- External leads store their discovery URL separately from Google Maps and site URLs; this preserves the source without falsely treating it as the company's own website.
- Daily lead mining runs from a pg_cron job calling /api/public/hooks/daily-mining, guarded by the cron secret; results go to daily_leads (separate from leads) so unreviewed finds never pollute the pipeline.
- Notifications use payload-less Web Push signed with a VAPID key derived from the VAPID_SEED secret; the service worker fetches the text from /api/public/push/latest, avoiding payload encryption on the worker runtime.
- Daily mining logic lives in src/lib/mining.server.ts, shared by the midnight cron and the per-user "regenerate" server function, and honours per-user user_settings (on/off, niche, state).
- Inactivity reminders run from an hourly pg_cron job calling /api/public/hooks/inactivity-reminder; the app pings user_settings.last_active_at at most every 10 minutes and one reminder is sent per idle period.
- WhatsApp: a aba /whatsapp usa servidor Evolution API (segredos EVOLUTION_API_URL/KEY); instâncias prefixadas pelo id do usuário para isolar contas.
- Agendamentos de WhatsApp ficam em wa_scheduled e saem por um pg_cron a cada 18 min (mensagens seguintes do funil saem na mesma rodada) chamando /api/public/hooks/wa-dispatch (segredo do cron); a linha é reservada (pendente→enviando) antes do envio para não duplicar.
- Ao fim de cada rodada, o wa-dispatch agenda um "despertador" pg_cron de uso único (public.schedule_dispatch_wake, se auto-remove) no minuto do próximo envio quando ele cai antes da rodada fixa; assim os horários são cumpridos sem aumentar a frequência fixa.
- Papa Lead is a separate business: its data lives only in pl_* tables and is sent by the existing wa-dispatch cron; never join it with BatRadar leads/blocks/campaigns.
- pg_cron jobs authenticate to /api/public/hooks/* with a server-only token in public.cron_tokens (checked by src/lib/cron-guard.server.ts, alongside the platform cron secret); the vault cron secret drifted and caused silent 401s.
- Daily mining learns per user without AI: saved/advanced leads are weighted positives, discards (mining_feedback) and lost leads are negatives, scored over profile features (reviews/rating buckets, web presence, chain/shopping hints, niche, name words); keeps the learning free.
- Saving companies to a lead block also upserts them into leads (pipeline) without changing existing status; blocks are campaign segments, the pipeline is the master list.
- Regenerating daily leads stores the replaced ones as mining_feedback kind "visto" so they never return; campaign messages unanswered for 4+ days count as negative learning signals.
