// Define the colors object with literal types.
const colors = {
  primary: "this:primary",
  secondary: "this:secondary",
  info: "this:info",
  success: "this:success",
  warning: "this:warning",
  error: "this:error",
} as const;

export type ColorKey = keyof typeof colors;

/**
 * Returns the class name for the specified color.
 */
export function setThisClass(color: ColorKey): string {
  const className = colors[color];
  if (!className) {
    throw new Error(`Color "${color}" not found in the color map.`);
  }
  return className;
}
