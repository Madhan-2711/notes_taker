import type QuillType from "quill";
import type { BlockEmbed as BlockEmbedType } from "quill/blots/block";
import { RICH_FONT_SIZES, sanitizeImageValue } from "./richText";

export const RICH_FORMATS = ["size", "header", "bold", "italic", "underline", "strike", "color", "background", "list", "align"];

export const RICH_TOOLBAR = [
  [{ size: ["12px", "14px", "16px", false, "24px", "32px", "48px"] }],
  [{ header: [1, 2, 3, false] }],
  ["bold", "italic", "underline", "strike"],
  [{ color: [] }, { background: [] }],
  [{ list: "ordered" }, { list: "bullet" }, { list: "check" }],
  [{ align: [] }],
  ["clean"],
];

let loading: Promise<typeof QuillType> | null = null;

/** Loads Quill in the browser and registers the app's formats exactly once. */
export function loadQuill(): Promise<typeof QuillType> {
  loading ??= (async () => {
    const [{ default: Quill }, { default: Cursors }] = await Promise.all([
      import("quill"),
      import("quill-cursors/core"),
    ]);

    const sizeStyle = Quill.import("attributors/style/size") as { whitelist: string[] };
    sizeStyle.whitelist = [...RICH_FONT_SIZES];
    Quill.register(sizeStyle as never, true);
    Quill.register("modules/cursors", Cursors);

    const BlockEmbed = Quill.import("blots/block/embed") as typeof BlockEmbedType;
    class NoteImageBlot extends BlockEmbed {
      static blotName = "noteImage";
      static tagName = "FIGURE";
      static className = "ql-note-image";

      static create(value: unknown) {
        const node = super.create() as HTMLElement;
        const image = sanitizeImageValue(value) ?? { id: "", alt: "" };
        node.setAttribute("contenteditable", "false");
        node.dataset.id = image.id;
        node.dataset.alt = image.alt;
        const img = document.createElement("img");
        img.alt = image.alt || "Note image";
        img.draggable = false;
        node.appendChild(img);
        return node;
      }

      static value(node: HTMLElement) {
        return { id: node.dataset.id ?? "", alt: node.dataset.alt ?? "" };
      }
    }
    Quill.register(NoteImageBlot as never, true);
    return Quill;
  })();
  return loading;
}
