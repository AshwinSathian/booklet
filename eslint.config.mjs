import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
	baseDirectory: __dirname,
});

const eslintConfig = [
	{
		ignores: [
			".next/**",
			".open-next/**",
			".wrangler/**",
			"out/**",
			"dist/**",
			"node_modules/**",
			"mcp-server/**",
			"public/primereact-themes/**",
			"scripts/stub-og.cjs",
		],
	},
	...compat.extends("next/core-web-vitals", "next/typescript"),
	{
		rules: {
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
