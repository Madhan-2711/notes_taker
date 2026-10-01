import { privatePageMetadata } from "../../lib/seo";

export const metadata = privatePageMetadata;

export default function AccessLayout({ children }: { children: React.ReactNode }) {
  return children;
}
