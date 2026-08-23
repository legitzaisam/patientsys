import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // AppShell scrolls inside <main>, not the window.
    scrollToTopSelectors: ["#app-main-scroll"],
    defaultPreloadStaleTime: 0,
  });

  return router;
};
