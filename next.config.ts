import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n.ts");

const nextConfig: NextConfig = {
  agentRules: false,
  output: "standalone",
  // Private reference PDFs are supplied by a runtime mount, never deployment bundles.
  outputFileTracingExcludes: {"/api/payroll-references": ["./.local/**/*"]},
};

export default withNextIntl(nextConfig);
