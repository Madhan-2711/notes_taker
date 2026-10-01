import Image from "next/image";

/** Profile photo, or the first letter of the name on a tinted circle. */
export function Avatar({ name, photoURL, size = 44 }: { name?: string | null; photoURL?: string | null; size?: number }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-indigo-50 font-bold text-indigo-800"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      aria-hidden="true"
    >
      {photoURL
        ? <Image src={photoURL} alt="" width={size} height={size} className="h-full w-full object-cover" />
        : (name?.trim().charAt(0).toUpperCase() || "?")}
    </div>
  );
}
