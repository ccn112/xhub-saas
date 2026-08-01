import { colors } from "@/constants/colors";
import {
  DarkColor,
  LightColor,
  PrimaryColor,
  ThemeConfig,
} from "./@types/theme";

const DEFAULT_DARK_COLOR: DarkColor = "cinder";
const DEFAULT_LIGHT_COLOR: LightColor = "slate";
// "default" keeps the brand primary defined in globals.css (@theme #1769e0).
const DEFAULT_PRIMARY_COLOR: PrimaryColor = "default";

// Default theme configuration
export const defaultTheme: ThemeConfig = {
  themeMode: "system",
  isMonochrome: false,
  themeLayout: "main-layout",
  cardSkin: "bordered",

  darkColorScheme: {
    name: DEFAULT_DARK_COLOR,
    ...colors[DEFAULT_DARK_COLOR],
  },

  lightColorScheme: {
    name: DEFAULT_LIGHT_COLOR,
    ...colors[DEFAULT_LIGHT_COLOR],
  },

  primaryColorScheme: {
    name: DEFAULT_PRIMARY_COLOR,
    // brand primary lives in globals.css; keep the scheme numbers from blue as
    // a sensible fallback for the Customizer swatch preview.
    ...colors.blue,
  },

  notification: {
    isExpanded: false,
    position: "bottom-right",
    visibleToasts: 4,
  },
};
