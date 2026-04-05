/** DOM id for a source card — must match artifact "jump to source" buttons. */
export function citationAnchorId(manualId: string, pageNumber: number): string {
  return `source-${manualId}-${pageNumber}`;
}
