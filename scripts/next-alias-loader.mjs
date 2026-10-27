import { pathToFileURL } from "node:url";
import { resolve as resolvePath } from "node:path";

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const absolutePath = resolvePath(
      process.cwd(),
      specifier.slice(2)
    );

    return nextResolve(
      pathToFileURL(absolutePath).href,
      context
    );
  }

  return nextResolve(specifier, context);
}
