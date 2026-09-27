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

// Browser printing preserves Unicode and supports Save as PDF without sending
// decrypted note content to a rendering service. Text is never parsed as HTML.
export function printNote(title: string, content: string) {
  const popup = window.open("", "_blank");
  if (!popup) throw new Error("Allow pop-ups to open the PDF preview.");
  popup.opener = null;
  const doc = popup.document;
  doc.title = safeFilename(title);
  const style = doc.createElement("style");
  style.textContent = "@page{size:A4;margin:20mm}body{font:16px/1.7 system-ui,sans-serif;color:#0f172a;max-width:800px;margin:32px auto;padding:16px}h1{font-size:28px;overflow-wrap:anywhere}pre{font:inherit;white-space:pre-wrap;overflow-wrap:anywhere}button{padding:12px 20px;cursor:pointer}@media print{button,p.hint{display:none}body{margin:0;padding:0}}";
  doc.head.append(style);
  const button = doc.createElement("button");
  button.textContent = "Print / Save as PDF";
  button.onclick = () => popup.print();
  const hint = doc.createElement("p");
  hint.className = "hint";
  hint.textContent = "Choose Save as PDF in the print dialog. This export contains the note text; download attachments separately.";
  const heading = doc.createElement("h1");
  heading.textContent = title;
  const body = doc.createElement("pre");
  body.textContent = content;
  doc.body.append(button, hint, heading, body);
}
