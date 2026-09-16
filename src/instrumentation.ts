/**
 * Next.js compiles this file for BOTH the nodejs and edge runtimes. The font
 * bootstrap needs fs/os/path, which don't exist in edge — so that logic lives
 * in instrumentation-node.ts and is reached only through a dynamic import
 * inside the nodejs branch below. Next statically replaces NEXT_RUNTIME per
 * bundle, so the edge build eliminates this whole branch (dynamic import
 * included) instead of trying to bundle fs/os/path.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { configureFontConfig } = await import("./instrumentation-node");
    configureFontConfig();
  }
}
