import { useEffect, useMemo, useRef, useState } from "react";
import { BackHandler, StyleSheet, View } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { PathExploreThread } from "@/components/pathways/PathExploreThread";
import { EmptyState, ScreenLoader } from "@/components/ui";
import { pathTheme } from "@/constants/path-theme";
import { trackEvent } from "@/lib/analytics";
import {
  api,
  type PathDiscussionLink,
  type PathExploreNode,
} from "@/lib/api";
import { getToken } from "@/lib/session";
import { usePathExplore } from "@/hooks/useSessionQueries";

function stageTabLabel(node: PathExploreNode): { line1: string; line2: string } {
  const title = node.title;
  if (/this year/i.test(title) || node.slug.includes("-now")) {
    return { line1: "Grade 9", line2: "This year" };
  }
  if (/next year/i.test(title)) {
    return { line1: "Grade 10", line2: "Next year" };
  }
  if (/explore ahead|after grade 10|options after/i.test(title)) {
    return { line1: "After Grade 10", line2: "Explore ahead" };
  }
  if (/after class 10|after ssc|after igcse/i.test(title)) {
    return { line1: title.replace(/^After\s+/i, ""), line2: "Explore ahead" };
  }
  const parts = title.split(/[·—-]/).map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) return { line1: parts[0], line2: parts.slice(1).join(" · ") };
  return { line1: title, line2: node.kicker || "Explore" };
}

function pathToNode(
  nodes: PathExploreNode[],
  focusId: string
): PathExploreNode[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const chain: PathExploreNode[] = [];
  let current = byId.get(focusId);
  while (current) {
    chain.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return chain;
}

export default function PathwaysHubScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ childId?: string }>();
  const paramChildId =
    typeof params.childId === "string" ? params.childId : undefined;
  const [childId, setChildId] = useState<string | undefined>(paramChildId);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [activeStageId, setActiveStageId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [discussions, setDiscussions] = useState<
    Record<string, PathDiscussionLink[] | "loading" | "error">
  >({});
  const [asking, setAsking] = useState(false);
  const [askDraft, setAskDraft] = useState("");
  const [askBusy, setAskBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const appliedChildRef = useRef<string | null>(null);

  useEffect(() => {
    if (paramChildId && paramChildId !== childId) {
      setChildId(paramChildId);
      appliedChildRef.current = null;
    }
  }, [paramChildId, childId]);

  const pathQuery = usePathExplore(childId);
  const data = pathQuery.data ?? null;
  const loading = pathQuery.isPending && !data;
  const error =
    actionError ??
    (pathQuery.error instanceof Error
      ? pathQuery.error.message
      : pathQuery.isError
        ? "Could not load Child's Path."
        : null);

  useEffect(() => {
    const next = pathQuery.data;
    if (!next) return;
    const nextChildId = next.context.childId;
    if (appliedChildRef.current === nextChildId) return;
    appliedChildRef.current = nextChildId;
    const root = next.nodes.find((node) => node.depth === 0);
    const direct = root
      ? next.nodes.filter((node) => node.parentId === root.id)
      : [];
    const panes = direct.filter(
      (node) =>
        node.kind === "section" ||
        /this year|next year|explore ahead|after grade|after class|options after/i.test(
          node.title
        )
    );
    const stages = panes.length >= 2 ? panes : [];
    const firstFocus = stages[0] ?? root;
    setExpanded(new Set());
    setDiscussions({});
    setAsking(false);
    setActionError(null);
    setActiveStageId(stages[0]?.id ?? null);
    setFocusId(firstFocus?.id ?? null);
    if (!childId && nextChildId) setChildId(nextChildId);
    trackEvent("child_path_opened", { family: next.locationTitle });
  }, [pathQuery.data, childId]);

  const selectedId = childId ?? data?.context.childId ?? null;

  const root = useMemo(
    () => data?.nodes.find((node) => node.depth === 0) ?? null,
    [data]
  );

  const stageNodes = useMemo(() => {
    if (!data || !root) return [];
    const direct = data.nodes.filter((node) => node.parentId === root.id);
    const panes = direct.filter(
      (node) =>
        node.kind === "section" ||
        /this year|next year|explore ahead|after grade|after class|options after/i.test(
          node.title
        )
    );
    return panes.length >= 2 ? panes : [];
  }, [data, root]);

  const stageTabs = useMemo(
    () =>
      stageNodes.map((node) => {
        const label = stageTabLabel(node);
        return { id: node.id, ...label };
      }),
    [stageNodes]
  );

  const focus =
    data?.nodes.find((node) => node.id === focusId) ??
    stageNodes[0] ??
    root;

  const breadcrumb = useMemo(() => {
    if (!data || !focus) return [];
    const full = pathToNode(data.nodes, focus.id);
    // Drop the absolute root when stage panes exist.
    if (stageNodes.length > 0 && full[0]?.id === root?.id) return full.slice(1);
    return full;
  }, [data, focus, root, stageNodes]);

  const childrenByParent = useMemo(() => {
    const map = new Map<string, PathExploreNode[]>();
    if (!data) return map;
    for (const node of data.nodes) {
      if (!node.parentId) continue;
      const list = map.get(node.parentId);
      if (list) list.push(node);
      else map.set(node.parentId, [node]);
    }
    return map;
  }, [data]);

  const cards = focus ? (childrenByParent.get(focus.id) ?? []) : [];

  const nestedByParent = useMemo(() => {
    const map: Record<string, PathExploreNode[]> = {};
    for (const card of cards) {
      if (card.kind !== "section") continue;
      map[card.id] = childrenByParent.get(card.id) ?? [];
    }
    return map;
  }, [cards, childrenByParent]);

  const askDrafts = useRef<Record<string, string>>({});

  function selectStage(id: string) {
    setActiveStageId(id);
    setFocusId(id);
    setExpanded(new Set());
    setAsking(false);
    trackEvent("path_branch_opened", { branch: id });
  }

  function openCard(node: PathExploreNode) {
    setFocusId(node.id);
    setAsking(false);
    if (stageNodes.some((stage) => stage.id === node.id)) {
      setActiveStageId(node.id);
    }
    trackEvent("path_branch_opened", { branch: node.slug });
  }

  function levelUp() {
    if (!focus?.parentId) return;
    setAsking(false);
    const parentIsRoot = focus.parentId === root?.id;
    if (parentIsRoot) {
      setFocusId(activeStageId ?? focus.parentId);
      return;
    }
    setFocusId(focus.parentId);
  }

  const levelUpRef = useRef(levelUp);
  levelUpRef.current = levelUp;
  const canStepUp = breadcrumb.length > 1;

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!canStepUp) return false;
      levelUpRef.current();
      return true;
    });
    return () => sub.remove();
  }, [canStepUp]);

  function toggleExpand(id: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else {
        for (const card of cards) {
          if (card.kind === "section") next.delete(card.id);
        }
        next.add(id);
      }
      return next;
    });
  }

  async function readDiscussions() {
    if (!focus) return;
    const token = await getToken();
    if (!token) return;
    setDiscussions((current) => ({ ...current, [focus.id]: "loading" }));
    try {
      const result = await api.getPathDiscussions(token, focus.id);
      setDiscussions((current) => ({ ...current, [focus.id]: result.discussions }));
    } catch {
      setDiscussions((current) => ({ ...current, [focus.id]: "error" }));
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
    if (!data || !focus || !selectedId) return;
    const token = await getToken();
    if (!token) return;
    setAskBusy(true);
    try {
      const result = await api.askOnPath(token, {
        childId: selectedId,
        nodeId: focus.id,
        body: askDraft.trim(),
      });
      trackEvent("path_composer_opened", { branch: focus.slug });
      setAsking(false);
      setAskDraft("");
      router.push({
        pathname: "/(app)/messages/threads/[threadId]",
        params: { threadId: result.threadId },
      } as never);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Could not post the question.");
    } finally {
      setAskBusy(false);
    }
  }

  const waitingForChild = Boolean(
    childId && data?.context.childId && data.context.childId !== childId
  );
  if ((loading && !data) || (waitingForChild && pathQuery.isFetching)) {
    return (
      <View style={styles.screen}>
        <ScreenLoader label="Loading Child's Path" />
      </View>
    );
  }

  if ((error && !data) || (waitingForChild && pathQuery.isError)) {
    return (
      <View style={styles.screen}>
        <EmptyState icon="map-outline" title="Child's Path unavailable" message={error} />
      </View>
    );
  }

  if (!data || !focus) return null;

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
        <PathExploreThread
          locationTitle={data.locationTitle}
          stateLabel={data.context.stateLabel ?? "India (national)"}
          postingCircleName={data.postingCircle?.displayName ?? null}
          children={data.children}
          selectedChildId={selectedId}
          stageTabs={stageTabs}
          activeStageId={activeStageId}
          focus={focus}
          breadcrumb={breadcrumb}
          cards={cards}
          nestedByParent={nestedByParent}
          expandedIds={expanded}
          discussions={discussions[focus.id]}
          asking={asking}
          askDraft={askDraft}
          askBusy={askBusy}
          contentRefreshing={pathQuery.isFetching && Boolean(data)}
          onMore={() => router.back()}
          onSelectChild={(id) => {
            if (id === selectedId) return;
            setChildId(id);
          }}
          onSelectStage={selectStage}
          onOpenCard={openCard}
          onToggleExpand={toggleExpand}
          onLevelUp={levelUp}
          onOpenDetail={(slug, title) =>
            router.push({
              pathname: "/(app)/pathways/[slug]",
              params: { slug, title },
            } as never)
          }
          onRead={readDiscussions}
          onOpenDiscussion={openDiscussion}
          onStartAsk={() => {
            setAsking(true);
            setAskDraft(askDrafts.current[focus.id] ?? focus.askPrompt ?? "");
          }}
          onChangeAsk={(text) => {
            askDrafts.current[focus.id] = text;
            setAskDraft(text);
          }}
          onSendAsk={sendAsk}
          onCancelAsk={() => setAsking(false)}
        />
        {error ? (
          <EmptyState icon="alert-circle-outline" title="Could not post" message={error} />
        ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: pathTheme.bg },
});
