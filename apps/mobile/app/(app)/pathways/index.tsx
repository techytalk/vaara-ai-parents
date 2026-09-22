import { useCallback, useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { PathExploreThread } from "@/components/pathways/PathExploreThread";
import { EmptyState, ScreenLoader } from "@/components/ui";
import { pathTheme } from "@/constants/path-theme";
import { spacing } from "@/constants/theme";
import { trackEvent } from "@/lib/analytics";
import {
  api,
  type PathDiscussionLink,
  type PathExploreNode,
  type PathExploreResponse,
} from "@/lib/api";
import { getToken } from "@/lib/session";

function defaultExpanded(nodes: PathExploreNode[]): Set<string> {
  const open = new Set<string>();
  const root = nodes.find((node) => node.depth === 0);
  if (!root) return open;
  open.add(root.id);
  const first = nodes.find((node) => node.parentId === root.id);
  if (first) open.add(first.id);
  return open;
}

export default function PathwaysHubScreen() {
  const router = useRouter();
  const [data, setData] = useState<PathExploreResponse | null>(null);
  const [childId, setChildId] = useState<string | undefined>();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [discussions, setDiscussions] = useState<
    Record<string, PathDiscussionLink[] | "loading" | "error">
  >({});
  const [askingId, setAskingId] = useState<string | null>(null);
  const [askDraft, setAskDraft] = useState("");
  const [askBusy, setAskBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadSeq = useRef(0);

  const load = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    const seq = ++loadSeq.current;
    try {
      const next = await api.getPathExplore(token, childId);
      if (seq !== loadSeq.current) return;
      setData(next);
      setError(null);
      setExpanded(defaultExpanded(next.nodes));
      setDiscussions({});
      setAskingId(null);
      if (!childId && next.context.childId) setChildId(next.context.childId);
      trackEvent("child_path_opened", { family: next.locationTitle });
    } catch (e) {
      if (seq !== loadSeq.current) return;
      setData(null);
      setError(e instanceof Error ? e.message : "Could not load Child's Path.");
    }
  }, [childId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    load().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const selectedId = childId ?? data?.context.childId ?? null;

  function toggle(id: string) {
    const node = data?.nodes.find((row) => row.id === id);
    if (!node) return;
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
        return next;
      }
      for (const other of data?.nodes ?? []) {
        if (other.parentId === node.parentId) next.delete(other.id);
      }
      next.add(id);
      trackEvent("path_branch_opened", { branch: node.slug });
      return next;
    });
  }

  async function readDiscussions(nodeId: string) {
    const token = await getToken();
    if (!token) return;
    setDiscussions((current) => ({ ...current, [nodeId]: "loading" }));
    try {
      const result = await api.getPathDiscussions(token, nodeId);
      setDiscussions((current) => ({ ...current, [nodeId]: result.discussions }));
    } catch {
      setDiscussions((current) => ({ ...current, [nodeId]: "error" }));
    }
  }

  function openDiscussion(link: PathDiscussionLink) {
    if (link.openAs === "thread" && link.threadId) {
      router.push({
        pathname: "/(app)/messages/threads/[threadId]",
        params: { threadId: link.threadId },
      } as never);
      return;
    }
    router.push({
      pathname: "/(app)/messages/groups/[circleId]",
      params: { circleId: link.circleId, circleName: link.circleName },
    } as never);
  }

  async function sendAsk() {
    if (!data || !askingId || !selectedId) return;
    const token = await getToken();
    if (!token) return;
    setAskBusy(true);
    try {
      const result = await api.askOnPath(token, {
        childId: selectedId,
        nodeId: askingId,
        body: askDraft.trim(),
      });
      trackEvent("path_composer_opened", { branch: askingId });
      setAskingId(null);
      setAskDraft("");
      router.push({
        pathname: "/(app)/messages/threads/[threadId]",
        params: { threadId: result.threadId },
      } as never);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not post the question.");
    } finally {
      setAskBusy(false);
    }
  }

  if (loading && (!data || (childId && data.context.childId !== childId))) {
    return (
      <View style={styles.screen}>
        <ScreenLoader label="Loading Child's Path" />
      </View>
    );
  }

  if (error && !data) {
    return (
      <View style={styles.screen}>
        <EmptyState icon="map-outline" title="Child's Path unavailable" message={error} />
      </View>
    );
  }

  if (!data) return null;

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <PathExploreThread
          locationTitle={data.locationTitle}
          locationMeta={data.locationMeta}
          stateLabel={data.context.stateLabel ?? "India (national)"}
          lockLine={data.lockLine}
          postingCircleName={data.postingCircle?.displayName ?? null}
          nodes={data.nodes}
          children={data.children}
          selectedChildId={selectedId}
          expandedIds={expanded}
          discussions={discussions}
          askingId={askingId}
          askDraft={askDraft}
          askBusy={askBusy}
          onMore={() => router.back()}
          onSelectChild={(id) => {
            if (id === selectedId) return;
            setChildId(id);
          }}
          onToggle={toggle}
          onOpenDetail={(slug, title) =>
            router.push({
              pathname: "/(app)/pathways/[slug]",
              params: { slug, title },
            } as never)
          }
          onRead={readDiscussions}
          onOpenDiscussion={openDiscussion}
          onStartAsk={(node) => {
            setAskingId(node.id);
            setAskDraft(node.askPrompt ?? "");
          }}
          onChangeAsk={setAskDraft}
          onSendAsk={sendAsk}
          onCancelAsk={() => setAskingId(null)}
        />
        {error ? <EmptyState icon="alert-circle-outline" title="Could not post" message={error} /> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: pathTheme.bg },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl },
});
