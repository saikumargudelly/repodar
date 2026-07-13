import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthSession } from "@/lib/useAuthSession";

export const INGESTION_CADENCE_MS = 120 * 60 * 1000; // 2 hours

export function useUnreadAlerts() {
  const { isReady, userId } = useAuthSession();

  const query = useQuery({
    queryKey: ["sidebar-alerts"],
    queryFn: () => api.getAlerts(true, 200),
    enabled: isReady && !!userId,
    staleTime: INGESTION_CADENCE_MS,
  });

  return {
    unreadCount: query.data?.length ?? 0,
    alertsData: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
