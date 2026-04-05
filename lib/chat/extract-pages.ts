/**
 * Parse page number references from text like "pages 37, 40, 43",
 * "p. 24", "pp. 10–15", "pg 8", "(page 12)".
 */
export function extractReferencedPages(text: string): number[] {
  const pages: number[] = [];
  const patterns = [
    /(?:pages?|pp?\.?|pg\.?)\s*(\d+(?:\s*[-–—,&]\s*\d+)*)/gi,
    /\(page\s*(\d+)\)/gi,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(text)) !== null) {
      const segment = m[1];
      const rangeParts = segment.split(/\s*[-–—]\s*/);
      if (rangeParts.length === 2) {
        const start = parseInt(rangeParts[0], 10);
        const end = parseInt(rangeParts[1], 10);
        if (!isNaN(start) && !isNaN(end) && end >= start && end - start <= 20) {
          for (let i = start; i <= end; i++) pages.push(i);
          continue;
        }
      }
      const nums = segment.match(/\d+/g);
      if (nums) pages.push(...nums.map(Number));
    }
  }
  return [...new Set(pages)];
}
