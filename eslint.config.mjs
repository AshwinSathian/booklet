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
			"node_modules/**",
			"mcp-server/**",
			"scripts/stub-og.cjs",
		],
	},
	...nextVitals,
	...nextTs,
	{
		rules: {
			// New in eslint-config-next 16 (React Compiler rules from
			// eslint-plugin-react-hooks 7, plus one Next rule). This app does
			// not use the compiler, and the 25 existing hits are unreviewed, so
			// they warn rather than fail until someone reviews them.
			"react-hooks/set-state-in-effect": "warn",
			"react-hooks/purity": "warn",
			"react-hooks/refs": "warn",
			"@next/next/no-location-assign-relative-destination": "warn",
			// Allow the { secret: _s, ...rest } omit pattern without flagging _s.
			// ignoreRestSiblings is the canonical option for this idiom.
			"@typescript-eslint/no-unused-vars": [
				"warn",
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
