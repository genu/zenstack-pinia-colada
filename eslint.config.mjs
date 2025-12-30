import { defineConfig } from "eslint/config"
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended"

export default defineConfig(eslintPluginPrettierRecommended, {
  rules: {
    // Stylistic
    "@stylistic/quotes": "off",
    "@stylistic/brace-style": "off",
    "@stylistic/arrow-parens": "off",
    "@stylistic/member-delimiter-style": "off",
    "@stylistic/operator-linebreak": "off",
    "@stylistic/indent": "off",
    "@stylistic/quote-props": "off",
  },
})
