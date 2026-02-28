import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Receipts can be several megabytes; default is 1 MB.
      bodySizeLimit: "16mb",
    },
  },
};

export default withNextIntl(nextConfig);
