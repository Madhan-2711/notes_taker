import { afterEach, describe, expect, test } from "vitest";
import { isIndexableDeployment, productionSiteUrl } from "../src/lib/seo";

const original = {
  site: process.env.NEXT_PUBLIC_SITE_URL,
  vercelSite: process.env.VERCEL_PROJECT_PRODUCTION_URL,
  vercelEnv: process.env.VERCEL_ENV,
};

afterEach(() => {
  for (const [key, value] of Object.entries({
    NEXT_PUBLIC_SITE_URL: original.site,
    VERCEL_PROJECT_PRODUCTION_URL: original.vercelSite,
    VERCEL_ENV: original.vercelEnv,
  })) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("public search origin", () => {
  test("uses the production domain, not a preview deployment URL", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "notes.example.com";
    process.env.VERCEL_ENV = "production";
    expect(productionSiteUrl()?.href).toBe("https://notes.example.com/");
    expect(isIndexableDeployment()).toBe(true);
    process.env.VERCEL_ENV = "preview";
    expect(isIndexableDeployment()).toBe(false);
  });

  test("does not claim an indexable site without a valid domain", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    delete process.env.VERCEL_ENV;
    expect(productionSiteUrl()).toBeNull();
    expect(isIndexableDeployment()).toBe(false);
    process.env.VERCEL_ENV = "production";
    expect(isIndexableDeployment()).toBe(true);
  });
});
