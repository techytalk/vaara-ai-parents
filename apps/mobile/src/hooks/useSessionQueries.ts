import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api, type ActivityCategory, type MeBootstrap } from "@/lib/api";
import { authed } from "@/lib/authenticated-state";
import { getToken, saveSession } from "@/lib/session";
import { queryClient } from "@/providers/QueryProvider";

export const SESSION_STALE_MS = 2 * 60_000;

export const queryKeys = {
  sessionUser: ["sessionUser"] as const,
  children: ["me", "children"] as const,
  location: ["me", "location"] as const,
  stats: ["me", "stats"] as const,
  circles: ["circles"] as const,
  discover: (filter: string, search: string) =>
    ["discover", filter, search] as const,
  pathExplore: (childId?: string) =>
    ["pathExplore", childId ?? "default"] as const,
};

export function useSessionUser() {
  return useQuery({
    queryKey: queryKeys.sessionUser,
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error("Not signed in");
      const me = await api.me(token);
      await saveSession(token, me);
      return me;
    },
    staleTime: SESSION_STALE_MS,
  });
}

export function useChildren() {
  return useQuery({
    queryKey: queryKeys.children,
    queryFn: () => authed((token) => api.getChildren(token)),
    staleTime: SESSION_STALE_MS,
  });
}

export function useLocation() {
  return useQuery({
    queryKey: queryKeys.location,
    queryFn: () => authed((token) => api.getLocation(token)),
    staleTime: SESSION_STALE_MS,
  });
}

export function useMeStats() {
  return useQuery({
    queryKey: queryKeys.stats,
    queryFn: () => authed((token) => api.getMeStats(token)),
    staleTime: SESSION_STALE_MS,
  });
}

export function useDiscoverActivities(
  filter: string,
  search: string,
  apiFilter: {
    providerType?: "teacher" | "trainer" | "institution";
    category?: ActivityCategory;
  }
) {
  return useQuery({
    queryKey: queryKeys.discover(filter, search),
    queryFn: () =>
      authed((token) =>
        api.discoverActivities(token, {
          q: search.trim() || undefined,
          ...apiFilter,
          verifiedOnly: false,
          sort: "rating",
        })
      ),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
}

export function usePathExplore(childId?: string) {
  return useQuery({
    queryKey: queryKeys.pathExplore(childId),
    queryFn: () => authed((token) => api.getPathExplore(token, childId)),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
}

export async function hydrateSessionFromBootstrap() {
  const data = await authed((token) => api.getBootstrap(token));
  queryClient.setQueryData(queryKeys.sessionUser, data.user);
  queryClient.setQueryData(queryKeys.children, data.children);
  queryClient.setQueryData(queryKeys.location, data.location);
  queryClient.setQueryData(queryKeys.stats, data.stats);
  const token = await getToken();
  if (token) await saveSession(token, data.user);
  return data;
}

export function prefetchAppScreens() {
  void queryClient
    .prefetchQuery({
      queryKey: ["me", "bootstrap"],
      queryFn: hydrateSessionFromBootstrap,
      staleTime: SESSION_STALE_MS,
    })
    .then(() => {
      const data = queryClient.getQueryData<MeBootstrap>(["me", "bootstrap"]);
      if (!data) return;
      const hasPin = Boolean(data.location?.pinCode);
      const hasSchoolPath = data.children.some(
        (child) => child.track === "school" && child.curriculum?.code
      );
      if (hasPin) {
        void queryClient.prefetchQuery({
          queryKey: queryKeys.discover("all", ""),
          queryFn: () =>
            authed((token) =>
              api.discoverActivities(token, {
                verifiedOnly: false,
                sort: "rating",
              })
            ),
          staleTime: 60_000,
        });
      }
      if (hasSchoolPath) {
        void queryClient.prefetchQuery({
          queryKey: queryKeys.pathExplore(),
          queryFn: () => authed((token) => api.getPathExplore(token)),
          staleTime: 60_000,
        });
      }
    })
    .catch(() => undefined);
}
