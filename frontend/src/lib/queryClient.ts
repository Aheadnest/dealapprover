import { QueryClient } from "@tanstack/react-query";
import { ApiRequestError } from "./api/api";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (error instanceof ApiRequestError && error.status < 500) return false;
        return failureCount < 2;
      },
      staleTime: 30_000,
    },
  },
});
