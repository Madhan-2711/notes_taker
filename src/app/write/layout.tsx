import { privatePageMetadata } from "../../lib/seo";

export const metadata = privatePageMetadata;

export default function WriteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
