export function conversationIdFor(a: string, b: string): string {
  return [a, b].sort().join(":");
}

export function conversationIncludes(cid: string, self: string): boolean {
  return cid.split(":").includes(self);
}

export function getPeer(cid: string, self: string): string {
  return cid.split(":").find((p) => p !== self) ?? "";
}
