import { test as base, expect } from "@playwright/test";
import { startEnvironment } from "./environment";
import type { AcceptanceEnvironment } from "./environment";

export const test = base.extend<
  { environment: AcceptanceEnvironment; pageErrors: void },
  { workerEnvironment: AcceptanceEnvironment }
>({
  workerEnvironment: [
    async ({}, use) => {
      const environment = await startEnvironment();
      try {
        await use(environment);
      } finally {
        await environment.stop();
      }
    },
    { scope: "worker", timeout: 90_000 },
  ],
  environment: async ({ workerEnvironment }, use) => {
    await workerEnvironment.reset();
    try {
      await use(workerEnvironment);
    } finally {
      await workerEnvironment.reset();
    }
  },
  pageErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await use();
      expect(errors, "Unexpected browser JavaScript errors").toEqual([]);
    },
    { auto: true },
  ],
});
export { expect };
