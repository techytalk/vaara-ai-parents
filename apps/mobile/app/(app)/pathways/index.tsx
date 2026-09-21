import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { PathBranchHub } from "@/components/pathways/PathBranchHub";
import { EmptyState, ScreenLoader } from "@/components/ui";
import { pathTheme } from "@/constants/path-theme";
import { spacing } from "@/constants/theme";
import { trackEvent } from "@/lib/analytics";
import {
  api,
  type Circle,
  type PathBranch,
  type PathTopicId,
  type PathwayCard,
  type PathwayHubChild,
  type PathwayHubResponse,
} from "@/lib/api";
import { getToken } from "@/lib/session";

function pickPostingCircle(circles: Circle[]): Circle | null {
  // Path questions need mixed-grade replies (e.g. CBSE 11–12 parents),
  // not only the child’s current class. Use an existing circle only.
  const order: Circle["circleType"][] = [
    "curriculum",
    "school",
    "school_class",
    "class",
    "locality",
  ];
  for (const type of order) {
    const match = circles.find((circle) => circle.circleType === type);
    if (match) return match;
  }
  return circles[0] ?? null;
}

function allBranches(hub: PathwayHubResponse): PathBranch[] {
  return [...hub.branchMap.primary, ...hub.branchMap.overflow];
}

function collegeCards(hub: PathwayHubResponse): PathwayCard[] {
  return hub.groups
    .filter((group) => group.id !== "what_next")
    .flatMap((group) => group.cards)
    .filter((card) => !card.slug.startsWith("_"));
}

export default function PathwaysHubScreen() {
  const router = useRouter();
  const [hub, setHub] = useState<PathwayHubResponse | null>(null);
  const [circles, setCircles] = useState<Circle[]>([]);
  const [childId, setChildId] = useState<string | undefined>();
  const [stream, setStream] = useState("undecided");
  const [branchId, setBranchId] = useState<string | undefined>();
  const [topicId, setTopicId] = useState<PathTopicId>("subjects");
  const [itemLead, setItemLead] = useState<string | null>(null);
  const [otherOpen, setOtherOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    try {
      const [data, circleList] = await Promise.all([
        api.getPathwaysHub(token, { childId, stream }),
        api.getCircles(token).catch(() => [] as Circle[]),
      ]);
      setHub(data);
      setCircles(circleList);
      setError(null);
      if (!childId && data.context.childId) {
        setChildId(data.context.childId);
      }
      setBranchId((current) => {
        const ids = allBranches(data).map((branch) => branch.id);
        if (current && ids.includes(current)) return current;
        return data.branchMap.defaultBranchId;
      });
      trackEvent("child_path_opened", {
        family: data.context.family,
        stage: data.context.primaryStage,
      });
    } catch (e) {
      setHub(null);
      setError(
        e instanceof Error ? e.message : "Could not load Child's Path."
      );
    }
  }, [childId, stream]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const selectedBranch = useMemo(() => {
    if (!hub) return null;
    return (
      allBranches(hub).find((branch) => branch.id === branchId) ??
      allBranches(hub)[0] ??
      null
    );
  }, [hub, branchId]);

  useEffect(() => {
    if (!selectedBranch?.itemSlug) {
      setItemLead(null);
      return;
    }
    const fromHub = hub?.groups
      .flatMap((group) => group.cards)
      .find((card) => card.slug === selectedBranch.itemSlug);
    if (fromHub?.lead) {
      setItemLead(fromHub.lead);
      return;
    }
    getToken().then((token) => {
      if (!token || !selectedBranch.itemSlug) return;
      api
        .getPathwayItem(token, selectedBranch.itemSlug)
        .then((detail) => setItemLead(detail.item.lead))
        .catch(() => setItemLead(null));
    });
  }, [hub, selectedBranch]);

  function onChildPress(child: PathwayHubChild) {
    if (child.id === childId) return;
    setChildId(child.id);
    setStream("undecided");
    setBranchId(undefined);
    setTopicId("subjects");
  }

  const postingCircle = pickPostingCircle(circles);

  function openComposer() {
    if (!postingCircle || !selectedBranch) return;
    const prompt =
      selectedBranch.prompts[topicId] ??
      selectedBranch.prompts.subjects ??
      "";
    trackEvent("path_composer_opened", { branch: selectedBranch.id });
    router.push({
      pathname: "/circles/[circleId]/new-post",
      params: {
        circleId: postingCircle.id,
        compose: "question",
        body: prompt,
      },
    } as never);
  }

  function openDiscussions() {
    if (!postingCircle) {
      Alert.alert(
        "No discussions yet",
        "Join a class or school circle first. Exploring this branch does not change your child’s profile."
      );
      return;
    }
    router.push({
      pathname: "/circles/[circleId]",
      params: { circleId: postingCircle.id },
    } as never);
  }

  function openDetail() {
    if (!selectedBranch?.itemSlug) return;
    router.push({
      pathname: "/(app)/pathways/[slug]",
      params: { slug: selectedBranch.itemSlug, title: selectedBranch.title },
    } as never);
  }

  if (loading) {
    return (
      <View style={styles.screen}>
        <ScreenLoader label="Loading Child's Path" />
      </View>
    );
  }

  if (error || !hub || !selectedBranch) {
    return (
      <View style={styles.screen}>
        <EmptyState
          icon="map-outline"
          title="Child's Path unavailable"
          message={
            error ??
            "Add a school-age child with a board to see what comes next."
          }
        />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <PathBranchHub
          childLabel={hub.context.childLabel}
          stateLabel={hub.context.stateLabel ?? "India (national)"}
          stageLead={hub.context.stageLead}
          branchMap={hub.branchMap}
          selectedBranch={selectedBranch}
          topicId={
            hub.branchMap.topics.some((topic) => topic.id === topicId)
              ? topicId
              : hub.branchMap.topics[0]?.id ?? "subjects"
          }
          streamId={stream}
          streamChips={hub.context.streamChipLabels}
          showStreamChips={hub.context.showStreamChips}
          children={hub.children}
          selectedChildId={hub.context.childId}
          itemLead={itemLead}
          collegeCards={collegeCards(hub)}
          postingCircleName={postingCircle?.displayName ?? null}
          postingHint={
            postingCircle
              ? null
              : "Ask uses your existing class or school circle. Exploring DP or A Level does not add you to that board’s circle."
          }
          otherOpen={otherOpen}
          onToggleOther={() => setOtherOpen((open) => !open)}
          onSelectChild={onChildPress}
          onSelectBranch={(id) => {
            setBranchId(id);
            trackEvent("path_branch_opened", { branch: id });
            if (hub.branchMap.overflow.some((branch) => branch.id === id)) {
              setOtherOpen(true);
            }
          }}
          onSelectTopic={setTopicId}
          onSelectStream={(id) => setStream((prev) => (prev === id ? "undecided" : id))}
          onAsk={openComposer}
          onRead={openDiscussions}
          onLearnMore={openDetail}
          onOpenCard={(slug, title) =>
            router.push({
              pathname: "/(app)/pathways/[slug]",
              params: { slug, title },
            } as never)
          }
          onMore={() => router.back()}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: pathTheme.bg },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
});
