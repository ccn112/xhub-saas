/**
 * Capitalizes the first character of a string and lowercases the rest.
 */
export const capitalize = (s: string) => {
  return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : "";
};
