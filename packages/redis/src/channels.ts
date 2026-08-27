export function circleChannel(circleId: string): string {
  return `circle:${circleId}`;
}

export function conversationChannel(conversationId: string): string {
  return `conversation:${conversationId}`;
}

export function topicChannel(slug: string): string {
  return `topic:${slug}`;
}
