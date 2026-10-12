import type { DeviceSpec, GradientPreset, ExportSize } from "./types";

export const GITHUB_REPO_URL = "https://github.com/oyeolamilekan/appshots";

export const devices: DeviceSpec[] = [
  {
    id: "iphone-15-pro-max",
    label: "iPhone 15 Pro Max",
    width: 1290,
    height: 2796,
    screenInset: { top: 20, right: 20, bottom: 20, left: 20 },
    cornerRadius: 110,
    frameRadius: { outer: "14%/6.5%", inner: "12.5%/5.8%" },
    notchWidth: 250,
    notchHeight: 70,
    hasIsland: true,
    colors: [
      {
        id: "black",
        label: "Black Titanium",
        frame: "#282828",
        frameColors: ["#4a4a4a", "#282828", "#1c1c1e", "#282828", "#4a4a4a"],
        screen: "#000",
      },
      {
        id: "natural",
        label: "Natural",
        frame: "#8C8883",
        frameColors: ["#AAA59E", "#8C8883", "#75726D", "#8C8883", "#AAA59E"],
        screen: "#000",
      },
      {
        id: "blue",
        label: "Blue",
        frame: "#2F3846",
        frameColors: ["#455163", "#2F3846", "#202630", "#2F3846", "#455163"],
        screen: "#000",
      },
      {
        id: "white",
        label: "White",
        frame: "#E3E3E4",
        frameColors: ["#F2F2F2", "#E3E3E4", "#D1D1D2", "#E3E3E4", "#F2F2F2"],
        screen: "#000",
      },
    ],
  },
  {
    id: "iphone-15-pro",
    label: "iPhone 15 Pro",
    width: 1179,
    height: 2556,
    screenInset: { top: 18, right: 18, bottom: 18, left: 18 },
    cornerRadius: 100,
    frameRadius: { outer: "14%/6.5%", inner: "12.5%/5.8%" },
    notchWidth: 230,
    notchHeight: 65,
    hasIsland: true,
    colors: [
      {
        id: "black",
        label: "Black Titanium",
        frame: "#282828",
        frameColors: ["#4a4a4a", "#282828", "#1c1c1e", "#282828", "#4a4a4a"],
        screen: "#000",
      },
      {
        id: "natural",
        label: "Natural",
        frame: "#8C8883",
        frameColors: ["#AAA59E", "#8C8883", "#75726D", "#8C8883", "#AAA59E"],
        screen: "#000",
      },
      {
        id: "blue",
        label: "Blue",
        frame: "#2F3846",
        frameColors: ["#455163", "#2F3846", "#202630", "#2F3846", "#455163"],
        screen: "#000",
      },
      {
        id: "white",
        label: "White",
        frame: "#E3E3E4",
        frameColors: ["#F2F2F2", "#E3E3E4", "#D1D1D2", "#E3E3E4", "#F2F2F2"],
        screen: "#000",
      },
    ],
  },
  {
    id: "iphone-14",
    label: "iPhone 14",
    width: 1170,
    height: 2532,
    screenInset: { top: 18, right: 18, bottom: 18, left: 18 },
    cornerRadius: 95,
    frameRadius: { outer: "14%/6.5%", inner: "12.5%/5.8%" },
    notchWidth: 210,
    notchHeight: 60,
    hasIsland: false,
    colors: [
      {
        id: "midnight",
        label: "Midnight",
        frame: "#2B3037",
        frameColors: ["#3A414A", "#2B3037", "#1E2227", "#2B3037", "#3A414A"],
        screen: "#000",
      },
      {
        id: "purple",
        label: "Purple",
        frame: "#E5DDEA",
        frameColors: ["#F0EAF5", "#E5DDEA", "#D5CDDA", "#E5DDEA", "#F0EAF5"],
        screen: "#000",
      },
      {
        id: "blue",
        label: "Blue",
        frame: "#A7C1D9",
        frameColors: ["#BDD3E8", "#A7C1D9", "#92AAC0", "#A7C1D9", "#BDD3E8"],
        screen: "#000",
      },
      {
        id: "red",
        label: "Red",
        frame: "#FC0324",
        frameColors: ["#FF3B55", "#FC0324", "#D4001A", "#FC0324", "#FF3B55"],
        screen: "#000",
      },
    ],
  },
  {
    id: "ipad-pro-12-9",
    label: 'iPad Pro 12.9"',
    width: 2048,
    height: 2732,
    screenInset: { top: 40, right: 40, bottom: 40, left: 40 },
    cornerRadius: 50,
    frameRadius: { outer: "3%/2.5%", inner: "2.5%/2%" },
    notchWidth: 0,
    notchHeight: 0,
    hasIsland: false,
    colors: [
      {
        id: "black",
        label: "Black",
        frame: "#1c1c1e",
        frameColors: ["#2c2c2e", "#1c1c1e", "#0d0d0d", "#1c1c1e", "#2c2c2e"],
        screen: "#000",
      },
      {
        id: "space-gray",
        label: "Space Gray",
        frame: "#4e4e50",
        frameColors: ["#636365", "#4e4e50", "#3a3a3c", "#4e4e50", "#636365"],
        screen: "#000",
      },
      {
        id: "silver",
        label: "Silver",
        frame: "#e0e0e0",
        frameColors: ["#ffffff", "#e0e0e0", "#d1d1d6", "#e0e0e0", "#ffffff"],
        screen: "#000",
      },
    ],
  },
  {
    id: "samsung-galaxy-s24-ultra",
    label: "Samsung Galaxy S24 Ultra",
    width: 1440,
    height: 3120,
    screenInset: { top: 16, right: 16, bottom: 16, left: 16 },
    cornerRadius: 40,
    frameRadius: { outer: "4%/2%", inner: "3.5%/1.8%" },
    notchWidth: 0,
    notchHeight: 0,
    hasIsland: false,
    colors: [
      {
        id: "titanium-black",
        label: "Titanium Black",
        frame: "#1a1a1a",
        frameColors: ["#2d2d2d", "#1a1a1a", "#0f0f0f", "#1a1a1a", "#2d2d2d"],
        screen: "#000",
      },
      {
        id: "titanium-gray",
        label: "Titanium Gray",
        frame: "#7a7a7a",
        frameColors: ["#8f8f8f", "#7a7a7a", "#656565", "#7a7a7a", "#8f8f8f"],
        screen: "#000",
      },
      {
        id: "titanium-violet",
        label: "Titanium Violet",
        frame: "#9b8aa5",
        frameColors: ["#b0a0ba", "#9b8aa5", "#867590", "#9b8aa5", "#b0a0ba"],
        screen: "#000",
      },
      {
        id: "titanium-yellow",
        label: "Titanium Yellow",
        frame: "#d4c87a",
        frameColors: ["#e5da90", "#d4c87a", "#c3b664", "#d4c87a", "#e5da90"],
        screen: "#000",
      },
    ],
  },
  {
    id: "samsung-galaxy-tab-s9",
    label: "Samsung Galaxy Tab S9",
    width: 1600,
    height: 2560,
    screenInset: { top: 35, right: 35, bottom: 35, left: 35 },
    cornerRadius: 40,
    frameRadius: { outer: "3%/2%", inner: "2.5%/1.5%" },
    notchWidth: 0,
    notchHeight: 0,
    hasIsland: false,
    colors: [
      {
        id: "graphite",
        label: "Graphite",
        frame: "#3c3c3c",
        frameColors: ["#4f4f4f", "#3c3c3c", "#292929", "#3c3c3c", "#4f4f4f"],
        screen: "#000",
      },
      {
        id: "beige",
        label: "Beige",
        frame: "#d9d0c5",
        frameColors: ["#ebe3d9", "#d9d0c5", "#c7beb3", "#d9d0c5", "#ebe3d9"],
        screen: "#000",
      },
    ],
  },
];

export const gradientPresets: GradientPreset[] = [
  { id: "sunset", label: "Sunset", from: "#ff7e5f", to: "#feb47b" },
  { id: "ocean", label: "Ocean", from: "#2b5876", to: "#4e4376" },
  { id: "mint", label: "Mint", from: "#00b09b", to: "#96c93d" },
  { id: "berry", label: "Berry", from: "#e1eec3", to: "#f05053" },
  { id: "royal", label: "Royal", from: "#141E30", to: "#243B55" },
  { id: "rose", label: "Rose", from: "#f4c4f3", to: "#fc67fa" },
];

// App Store screenshot sizes (portrait), per Apple's current spec:
// https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications
// The two REQUIRED slots are listed first as the defaults:
//   - iPhone "Dynamic Island (medium display)": 1179 x 2556
//   - iPad 13": 2064 x 2752
// Uploading only these lets App Store Connect scale down for other sizes.
export const exportSizes: ExportSize[] = [
  // --- Required ---
  {
    id: "iphone-di-medium",
    label: "iPhone 6.1\" — Dynamic Island (iPhone 15/16/17) — required",
    width: 1179,
    height: 2556,
  },
  {
    id: "ipad-13",
    label: "iPad 13\" (iPad Pro M4) — required",
    width: 2064,
    height: 2752,
  },
  // --- Other accepted iPhone sizes ---
  {
    id: "iphone-di-medium-alt",
    label: "iPhone 6.3\" — Dynamic Island (1206 × 2622)",
    width: 1206,
    height: 2622,
  },
  {
    id: "iphone-di-large",
    label: "iPhone 6.9\" — Dynamic Island (16/17 Pro Max)",
    width: 1320,
    height: 2868,
  },
  {
    id: "iphone-6.7",
    label: "iPhone 6.7\" (15/14 Pro Max)",
    width: 1290,
    height: 2796,
  },
  {
    id: "iphone-faceid-large",
    label: "iPhone 6.5\" — Face ID (11 Pro Max)",
    width: 1242,
    height: 2688,
  },
  {
    id: "iphone-5.5",
    label: "iPhone 5.5\" (8 Plus)",
    width: 1242,
    height: 2208,
  },
  // --- Other accepted iPad sizes ---
  {
    id: "ipad-12.9",
    label: "iPad 12.9\" (legacy)",
    width: 2048,
    height: 2732,
  },
];
