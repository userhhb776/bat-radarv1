import { QueryClient } from "@tanstack/react-query";
import { createRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { useEffect } from "react";
import { routeTree } from "./routeTree.gen";

const isChunkError = (e: unknown) =>
  e instanceof Error && /dynamically imported module|Importing a module script failed|error loading dynamically/i.test(e.message);

function DefaultError({ error, reset }: ErrorComponentProps) {
  const chunk = isChunkError(error);
  useEffect(() => {
    if (!chunk) return;
    const k = "chunk-reload-at";
    const last = Number(sessionStorage.getItem(k) ?? 0);
    if (Date.now() - last > 10000) {
      sessionStorage.setItem(k, String(Date.now()));
      window.location.reload();
    }
  }, [chunk]);
  return (
    <div className="grid min-h-[50vh] place-items-center p-6 text-center">
      <div className="grid gap-3">
        <p className="font-medium">{chunk ? "Carregando a nova versão…" : "Algo deu errado nesta tela."}</p>
        <button className="rounded-md border px-4 py-2 text-sm" onClick={() => (chunk ? window.location.reload() : reset())}>
          Tentar de novo
        </button>
      </div>
    </div>
  );
}

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    defaultErrorComponent: DefaultError,
  });

  return router;
};
