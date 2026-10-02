import { NextResponse } from "next/server";

// The service worker normally answers share-sheet POSTs on the device (public/sw.js).
// This only runs when it isn't active yet, e.g. right after installing; nothing shared
// is read or stored here.
export function POST(request: Request) {
  return NextResponse.redirect(new URL("/write?shared=unavailable", request.url), 303);
}

export function GET(request: Request) {
  return NextResponse.redirect(new URL("/write", request.url), 303);
}
