export function safeFilename(title: string): string {
  return title.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").replace(/[. ]+$/g, "").slice(0, 100) || "note";
}

export function exportText(title: string, content: string, markdown: boolean): string {
  const heading = title.replace(/[\r\n]+/g, " ");
  return `${markdown ? "# " : ""}${heading}\n\n${content}\n`;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = safeFilename(filename);
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
