import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  ROBOTS_RULES,
  renderRobotsTxt,
  renderSitemapXml,
  type RobotsRulesConfig,
} from "@/lib/public-routes";
import { parseRobotsEditorText, toRobotsEditorText } from "@/lib/robots-editor";

const CONFIG_PATH = "src/config/robots-rules.json";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data: isAdmin, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(`Role check failed: ${error.message}`);
  if (!isAdmin) throw new Error("Forbidden");
}

function previews(config: RobotsRulesConfig) {
  return { robotsTxt: renderRobotsTxt(config), sitemapXml: renderSitemapXml(config) };
}

export const getRobotsRules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as never);
    const { readFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    let config = ROBOTS_RULES;
    try {
      config = JSON.parse(await readFile(join(process.cwd(), CONFIG_PATH), "utf8"));
    } catch {
      // fall back to the bundled config (read-only environments)
    }
    return { text: toRobotsEditorText(config), config, ...previews(config) };
  });

export const previewRobotsRules = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ text: z.string().max(20000) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { config, errors } = parseRobotsEditorText(data.text, ROBOTS_RULES);
    return { errors, ...previews(config) };
  });

export const saveRobotsRules = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ text: z.string().max(20000) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { config, errors } = parseRobotsEditorText(data.text, ROBOTS_RULES);
    if (errors.length) return { saved: false, errors, ...previews(config) };

    try {
      const { writeFile } = await import("node:fs/promises");
      const { join } = await import("node:path");
      await writeFile(
        join(process.cwd(), CONFIG_PATH),
        JSON.stringify(config, null, 2) + "\n",
        "utf8",
      );
    } catch (e) {
      return {
        saved: false,
        errors: [
          `Could not write ${CONFIG_PATH}: ${(e as Error).message}. Rules can only be saved in an environment with a writable project directory.`,
        ],
        ...previews(config),
      };
    }

    return { saved: true, errors: [], ...previews(config) };
  });

const routeSchema = z.object({
  path: z.string().max(200),
  changefreq: z
    .enum(["always", "hourly", "daily", "weekly", "monthly", "yearly", "never"])
    .optional(),
  priority: z.string().max(8).optional(),
  publicRobots: z.boolean().optional(),
});

const configSchema = z.object({
  baseUrl: z.string().max(300),
  allow: z.array(routeSchema).max(500),
  disallow: z.array(z.string().max(200)).max(200),
  sitemaps: z.array(z.string().max(300)).max(20),
});

async function writeConfig(config: RobotsRulesConfig) {
  const { writeFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  await writeFile(
    join(process.cwd(), CONFIG_PATH),
    JSON.stringify(config, null, 2) + "\n",
    "utf8",
  );
}

export const previewRobotsConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ config: configSchema }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { cleanRobotsConfig, validateRobotsConfig } = await import(
      "@/lib/allowlist-editor"
    );
    const config = cleanRobotsConfig(data.config as RobotsRulesConfig);
    return { errors: validateRobotsConfig(config), config, ...previews(config) };
  });

export const saveRobotsConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ config: configSchema }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { cleanRobotsConfig, validateRobotsConfig } = await import(
      "@/lib/allowlist-editor"
    );
    const config = cleanRobotsConfig(data.config as RobotsRulesConfig);
    const errors = validateRobotsConfig(config);
    if (errors.length) return { saved: false, errors, config, ...previews(config) };

    try {
      await writeConfig(config);
    } catch (e) {
      return {
        saved: false,
        config,
        errors: [
          `Could not write ${CONFIG_PATH}: ${(e as Error).message}. Rules can only be saved in an environment with a writable project directory.`,
        ],
        ...previews(config),
      };
    }
    return { saved: true, errors: [], config, ...previews(config) };
  });
