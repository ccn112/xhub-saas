/**
 * Checks if the code is running on the server side.
 */
export const isServer =
  typeof window === "undefined" || typeof document === "undefined";
