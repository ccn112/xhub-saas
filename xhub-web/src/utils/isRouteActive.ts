/**
 * Checks if the given path matches the current pathname.
 *
 * Adapted from react-router's matchPath({ path, end: false }): a match occurs
 * when pathname equals path or begins with `path + "/"`.
 */
export function isRouteActive(
  path: string | undefined,
  pathname: string,
): boolean {
  if (!path) return false;
  const base = path.split("?")[0].replace(/\/+$/, "") || "/";
  if (base === "/") return pathname === "/";
  return pathname === base || pathname.startsWith(base + "/");
}
