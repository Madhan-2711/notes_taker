import { deltaToBlocks, deltaToHtml, imageIdsInDelta, type InlineAttributes, type RichDelta } from "./richText";
import { safeFilename } from "./noteExport";

export interface ExportImage {
  dataUrl: string;
  png: ArrayBuffer;
  width: number;
  height: number;
}

function escapeMarkdown(text: string): string {
  return text.replace(/([\\`*_[\]#<>])/g, "\\$1");
}

function markdownSegment(text: string, attributes: InlineAttributes = {}): string {
  if (!text.trim()) return text;
  let value = escapeMarkdown(text);
  if (attributes.strike) value = `~~${value}~~`;
  if (attributes.italic) value = `*${value}*`;
  if (attributes.bold) value = `**${value}**`;
  return value;
}

export function deltaToMarkdown(title: string, delta: RichDelta): string {
  const out = [`# ${title.replace(/[\r\n]+/g, " ")}`, ""];
  let number = 0;
  for (const block of deltaToBlocks(delta)) {
    if (block.kind === "image") {
      out.push(`*[Image: ${escapeMarkdown(block.image.alt || "picture")}]*`);
      number = 0;
      continue;
    }
    const text = block.segments.map((segment) => markdownSegment(segment.text, segment.attributes)).join("");
    const { list, header } = block.attributes;
    number = list === "ordered" ? number + 1 : 0;
    if (header) out.push(`${"#".repeat(header + 1)} ${text}`);
    else if (list === "bullet") out.push(`- ${text}`);
    else if (list === "ordered") out.push(`${number}. ${text}`);
    else if (list === "checked") out.push(`- [x] ${text}`);
    else if (list === "unchecked") out.push(`- [ ] ${text}`);
    else out.push(text);
  }
  return `${out.join("\n").trimEnd()}\n`;
}

/** Decrypts and re-encodes every picture as PNG, which both print and Word accept. */
export async function prepareExportImages(
  delta: RichDelta,
  load: (id: string) => Promise<Blob>
): Promise<Map<string, ExportImage>> {
  const images = new Map<string, ExportImage>();
  for (const id of new Set(imageIdsInDelta(delta))) {
    try {
      const bitmap = await createImageBitmap(await load(id));
      const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close?.();
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => (value ? resolve(value) : reject(new Error("Could not encode image."))), "image/png"));
      images.set(id, { dataUrl: canvas.toDataURL("image/png"), png: await blob.arrayBuffer(), width: canvas.width, height: canvas.height });
    } catch {
      // A missing picture becomes a labelled placeholder in the export.
    }
  }
  return images;
}

/** Must run directly in the click handler, before any await, or pop-up blockers refuse it. */
export function openPrintWindow(): Window {
  const popup = window.open("", "_blank");
  if (!popup) throw new Error("Allow pop-ups to open the PDF preview.");
  popup.opener = null;
  popup.document.title = "Preparing export…";
  return popup;
}

/**
 * Fills the print window with the formatted note so it can be saved as PDF
 * locally. The HTML comes from deltaToHtml, which escapes all text.
 */
export function printRichNote(popup: Window, title: string, delta: RichDelta, images: Map<string, ExportImage>) {
  const doc = popup.document;
  doc.title = safeFilename(title);
  const style = doc.createElement("style");
  style.textContent = [
    "@page{size:A4;margin:20mm}",
    "body{font:16px/1.7 system-ui,sans-serif;color:#0f172a;max-width:800px;margin:32px auto;padding:16px}",
    "h1.note-title{font-size:30px;margin:0 0 24px;overflow-wrap:anywhere}",
    "p,li{overflow-wrap:anywhere;margin:0 0 6px}",
    "ul.checklist{list-style:none;padding-left:4px}",
    "figure{margin:16px 0}figure img{max-width:100%;border-radius:8px}",
    "button{padding:12px 20px;cursor:pointer}",
    "@media print{button,p.hint{display:none}body{margin:0;padding:0}}",
  ].join("");
  doc.head.append(style);
  const button = doc.createElement("button");
  button.textContent = "Print / Save as PDF";
  button.onclick = () => popup.print();
  const hint = doc.createElement("p");
  hint.className = "hint";
  hint.textContent = "Choose Save as PDF in the print dialog.";
  const heading = doc.createElement("h1");
  heading.className = "note-title";
  heading.textContent = title;
  const body = doc.createElement("article");
  body.innerHTML = deltaToHtml(delta, (id) => images.get(id)?.dataUrl);
  doc.body.append(button, hint, heading, body);
}

function hexColor(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (value.startsWith("#")) {
    const hex = value.slice(1);
    return (hex.length === 3 ? hex.split("").map((part) => part + part).join("") : hex).toUpperCase();
  }
  const match = value.match(/\d{1,3}/g);
  if (!match || match.length < 3) return undefined;
  return match.slice(0, 3).map((part) => Math.min(255, Number(part)).toString(16).padStart(2, "0")).join("").toUpperCase();
}

/** Builds a Word document with headings, lists, checklists, text styling and pictures. */
export async function buildDocx(title: string, delta: RichDelta, images: Map<string, ExportImage>): Promise<Blob> {
  const docx = await import("docx");
  const { AlignmentType, Document, HeadingLevel, ImageRun, LevelFormat, Packer, Paragraph, ShadingType, TextRun } = docx;
  const headings = { 1: HeadingLevel.HEADING_1, 2: HeadingLevel.HEADING_2, 3: HeadingLevel.HEADING_3 } as const;
  const alignments = { center: AlignmentType.CENTER, right: AlignmentType.RIGHT, justify: AlignmentType.JUSTIFIED } as const;

  const paragraphs: InstanceType<typeof Paragraph>[] = [new Paragraph({ text: title, heading: HeadingLevel.TITLE })];
  let orderedInstance = 0;
  let previousOrdered = false;

  for (const block of deltaToBlocks(delta)) {
    if (block.kind === "image") {
      previousOrdered = false;
      const image = images.get(block.image.id);
      if (!image) {
        paragraphs.push(new Paragraph({ children: [new TextRun({ text: `[Image: ${block.image.alt || "picture"}]`, italics: true })] }));
        continue;
      }
      const width = Math.min(600, image.width);
      const height = Math.round((image.height / image.width) * width);
      paragraphs.push(new Paragraph({ children: [new ImageRun({ type: "png", data: image.png, transformation: { width, height }, altText: { name: block.image.alt || "Image", description: block.image.alt || "Image", title: block.image.alt || "Image" } })] }));
      continue;
    }
    const { list, header, align } = block.attributes;
    const runs = [];
    if (list === "checked" || list === "unchecked") runs.push(new TextRun({ text: list === "checked" ? "☑ " : "☐ " }));
    for (const segment of block.segments) {
      const attributes = segment.attributes ?? {};
      const background = hexColor(attributes.background);
      runs.push(new TextRun({
        text: segment.text,
        bold: attributes.bold,
        italics: attributes.italic,
        strike: attributes.strike,
        underline: attributes.underline ? {} : undefined,
        color: hexColor(attributes.color),
        shading: background ? { type: ShadingType.CLEAR, fill: background, color: "auto" } : undefined,
        size: attributes.size ? Math.round(parseInt(attributes.size, 10) * 1.5) : undefined,
      }));
    }
    if (list === "ordered" && !previousOrdered) orderedInstance += 1;
    previousOrdered = list === "ordered";
    paragraphs.push(new Paragraph({
      children: runs,
      heading: header ? headings[header] : undefined,
      alignment: align ? alignments[align] : undefined,
      bullet: list === "bullet" ? { level: 0 } : undefined,
      numbering: list === "ordered" ? { reference: "ordered", level: 0, instance: orderedInstance } : undefined,
    }));
  }

  const document = new Document({
    title,
    numbering: {
      config: [{ reference: "ordered", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.START, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] }],
    },
    sections: [{ children: paragraphs }],
  });
  return Packer.toBlob(document);
}
