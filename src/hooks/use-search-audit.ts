import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
export function useSearchAudit(query: string, page: string) {
  useEffect(() => {
    if (!query.trim()) return;
    const timer = setTimeout(() => { void supabase.rpc("record_access", { _kind: "search", _page: page, _detail: { query: query.trim().slice(0,200) } }); }, 800);
    return () => clearTimeout(timer);
  }, [query,page]);
}