/** True when a mutation happened after the request captured `startedSeq`. */
export function isStaleResponse(startedSeq: number, currentSeq: number): boolean {
  return startedSeq !== currentSeq;
}
