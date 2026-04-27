// Clerk appearance tokens matching Readable's dark-first design system.
// Passed to <ClerkProvider appearance={...}> to theme all Clerk UI components.
export const clerkAppearance = {
  variables: {
    colorPrimary: "#7c5cfc",
    colorBackground: "#131720",
    colorInputBackground: "#0d1117",
    colorText: "#f0f2f8",
    colorTextSecondary: "#a8b3cc",
    colorInputText: "#f0f2f8",
    colorNeutral: "#6b7591",
    borderRadius: "0.75rem",
    fontFamily: "Inter, system-ui, sans-serif",
  },
  elements: {
    card: "shadow-glass border border-[rgba(255,255,255,0.07)] bg-[#131720]",
    formButtonPrimary:
      "bg-[#7c5cfc] hover:bg-[#6b47f5] text-white font-semibold rounded-full transition-colors",
    footerActionLink: "text-[#7c5cfc] hover:text-[#a78bfa] transition-colors",
    socialButtonsBlockButton:
      "border-[rgba(255,255,255,0.08)] bg-[#0d1117] text-[#f0f2f8] hover:bg-[rgba(255,255,255,0.05)]",
  },
} as const;
