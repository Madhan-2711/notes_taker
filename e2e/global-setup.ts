import { existsSync } from "node:fs";
import { AUTH_FILE } from "../playwright.config";

export default function globalSetup() {
  if (!existsSync(AUTH_FILE)) {
    throw new Error(`No saved session at ${AUTH_FILE}. Run "npm run e2e:login" and sign in once, then run the tests again.`);
  }
}
