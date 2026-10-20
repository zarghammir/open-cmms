import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Type errors fail the build on purpose. Lint runs as its own step; Next 16
  // no longer accepts an `eslint` key here.
  typescript: { ignoreBuildErrors: false },
};

const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
