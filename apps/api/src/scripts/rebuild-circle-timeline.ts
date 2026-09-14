import "../env.js";
import { rebuildCircleTimeline } from "../services/feed-timeline.js";

const circleId = process.argv[2];
const { rebuilt, total } = await rebuildCircleTimeline(circleId);
console.log(
  `Rebuilt ${rebuilt}/${total} circle timeline${total === 1 ? "" : "s"}`
);
process.exit(rebuilt === 0 && total > 0 ? 1 : 0);
