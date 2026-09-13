export interface TextDelta {
  start: number;
  deleteCount: number;
  insertText: string;
}

/** Compute one contiguous replacement that transforms oldText into newText. */
export function computeTextDelta(oldText: string, newText: string): TextDelta {
  let start = 0;
  while (
    start < oldText.length &&
    start < newText.length &&
    oldText[start] === newText[start]
  ) {
    start++;
  }

  let oldSuffix = oldText.length;
  let newSuffix = newText.length;
  while (
    oldSuffix > start &&
    newSuffix > start &&
    oldText[oldSuffix - 1] === newText[newSuffix - 1]
  ) {
    oldSuffix--;
    newSuffix--;
  }

  return {
    start,
    deleteCount: oldSuffix - start,
    insertText: newText.slice(start, newSuffix),
  };
}
