export interface TextDelta {
  start: number;
  deleteCount: number;
  insertText: string;
}

export interface CollaborativeTextOperation {
  retain?: number;
  insert?: unknown;
  delete?: number;
}

/**
 * Map a local selection through a remote Yjs delta.
 *
 * Retains and deletes consume positions in the old text; inserts do not. An
 * insertion exactly at the local cursor stays to its right so two users typing
 * at the same position do not pull each other's cursor along.
 */
export function transformSelectionForRemoteDelta(
  selectionStart: number,
  selectionEnd: number,
  operations: readonly CollaborativeTextOperation[]
): { start: number; end: number } {
  const transformPosition = (offset: number) => {
    let sourcePosition = 0;
    let transformedPosition = offset;

    for (const operation of operations) {
      if (operation.retain !== undefined) {
        sourcePosition += operation.retain;
      } else if (operation.insert !== undefined) {
        const insertedLength =
          typeof operation.insert === "string" ? operation.insert.length : 1;
        if (sourcePosition < offset) transformedPosition += insertedLength;
      } else if (operation.delete !== undefined) {
        if (sourcePosition < offset) {
          transformedPosition -= Math.min(
            operation.delete,
            offset - sourcePosition
          );
        }
        sourcePosition += operation.delete;
      }
    }

    return transformedPosition;
  };

  return {
    start: transformPosition(selectionStart),
    end: transformPosition(selectionEnd),
  };
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
