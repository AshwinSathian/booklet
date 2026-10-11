import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = [
	{
		ignores: [
			".next/**",
			".open-next/**",
			".wrangler/**",
			"out/**",
			"dist/**",
			"packages/*/dist/**",
			"packages/*/dist.previous/**",
			"node_modules/**",
			"scripts/stub-og.cjs",
		],
	},
	...nextVitals,
	...nextTs,
	{
		rules: {
			// React Compiler rules (eslint-plugin-react-hooks 7) and one Next
			// rule. Every hit was reviewed in 2026-10: most were rewritten, and
			// each one left is disabled in place with its reason. So these fail.
			"react-hooks/set-state-in-effect": "error",
			"react-hooks/purity": "error",
			"react-hooks/refs": "error",
			"@next/next/no-location-assign-relative-destination": "error",
			// Allow the { secret: _s, ...rest } omit pattern without flagging _s.
			// ignoreRestSiblings is the canonical option for this idiom.
			"@typescript-eslint/no-unused-vars": [
				"error",
				{
					args: "after-used",
					argsIgnorePattern: "^_",
					caughtErrors: "all",
					caughtErrorsIgnorePattern: "^_",
					destructuredArrayIgnorePattern: "^_",
					varsIgnorePattern: "^_",
					ignoreRestSiblings: true,
				},
			],
		},
	},
];

export default eslintConfig;
