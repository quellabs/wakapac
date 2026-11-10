import js from "@eslint/js";
import globals from "globals";
import {defineConfig} from "eslint/config";

export default defineConfig([
    {
        ignores: ["**/*.min.js"]
    },
    {
        files          : ["**/*.{js,mjs,cjs}"],
        plugins        : {js},
        extends        : ["js/recommended"],
        languageOptions: {globals: globals.browser},
        rules          : {
            "no-unused-vars": [
                "error",
                {
                    argsIgnorePattern        : "^_",
                    caughtErrorsIgnorePattern: "^_"
                }
            ]
        }
    },
    {
        files          : ["**/*.js"],
        languageOptions: {sourceType: "script"}
    },
    {
        files          : ["plugins/**/*.js"],
        languageOptions: {
            globals: {
                wakaPAC : "readonly",
                CKEDITOR: "readonly",
                Vimeo   : "readonly",
                YT      : "readonly"
            }
        },
        rules: {
            "no-nested-ternary"      : "error",
            "no-trailing-spaces"     : "error",
            "no-multiple-empty-lines": ["error", {max: 1, maxEOF: 0}],
            "padded-blocks"          : ["error", "never"],
            "comma-dangle"           : ["error", "never"],
            "key-spacing"            : ["error", {
                multiLine: {
                    beforeColon: false,
                    afterColon : true,
                    align      : "colon"
                }
            }],
            "object-property-newline": ["error", {allowAllPropertiesOnSameLine: true}],
            "array-element-newline"  : ["error", "consistent"],
            "array-bracket-newline"  : ["error", "consistent"],
            "no-restricted-syntax"   : [
                "error",
                {
                    selector: "ArrowFunctionExpression",
                    message : "Use a named method on the responsible object and bind it when needed."
                },
                {
                    selector: "CallExpression > FunctionExpression.arguments, NewExpression > FunctionExpression.arguments",
                    message : "Register a named object method instead of an inline callback."
                },
                {
                    selector: "FunctionDeclaration[id.name=/^[a-z_]/]",
                    message : "Move application helpers to the responsible class or runtime object."
                }
            ]
        }
    },
    {
        files          : ["playwright.config.js", "tests/**/*.js"],
        languageOptions: {globals: globals.node}
    }
]);
