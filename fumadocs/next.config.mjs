import { createMDX } from "fumadocs-mdx/next";

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  output: "standalone",

  async redirects() {
    return [
      {
        source: "/",
        destination: "/docs/manuals/getting-started",
        permanent: true, // 308 permanent redirect
      },
    ];
  },
};

export default withMDX(config);
