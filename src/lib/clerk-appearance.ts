// Clerk appearance tokens matching Readable's dark-first design system.
// Passed to <ClerkProvider appearance={...}> to theme all Clerk UI components.

const BASE_VARIABLES = {
  colorPrimary: "#7c5cfc",
  colorBackground: "#131720",
  colorInputBackground: "#0d1117",
  colorText: "#f0f2f8",
  colorTextSecondary: "#a8b3cc",
  colorInputText: "#f0f2f8",
  colorNeutral: "#6b7591",
  borderRadius: "0.75rem",
  fontFamily: "Inter, system-ui, sans-serif",
} as const;

const BASE_ELEMENTS = {
  card: "shadow-glass border border-[rgba(255,255,255,0.07)] bg-[#131720]",
  formButtonPrimary:
    "bg-[#7c5cfc] hover:bg-[#6b47f5] text-white font-semibold rounded-full transition-colors",
  footerActionLink: "text-[#7c5cfc] hover:text-[#a78bfa] transition-colors",
  socialButtonsBlockButton:
    "border-[rgba(255,255,255,0.08)] bg-[#0d1117] text-[#f0f2f8] hover:bg-[rgba(255,255,255,0.05)]",
} as const;

type AppearanceOptions = {
  /** When true, hides the Apple social login button (for non-Apple devices). */
  hideApple?: boolean;
};

export function buildClerkAppearance({ hideApple = false }: AppearanceOptions = {}) {
  return {
    variables: BASE_VARIABLES,
    elements: {
      ...BASE_ELEMENTS,
      // Suppress Apple Sign In on non-Apple platforms to avoid a confusing UX
      // (Apple requires your Apple ID to be accessible via the Apple app/browser).
      ...(hideApple
        ? { socialButtonsBlockButton__apple: { display: "none" } }
        : {}),
    },
  };
}

// Detect Apple device from User-Agent string.
// Covers: iPhone, iPad, iPod, and Macintosh (includes Apple Silicon Macs).
export function isAppleDevice(ua: string): boolean {
  return /iPhone|iPad|iPod|Macintosh/.test(ua);
}
