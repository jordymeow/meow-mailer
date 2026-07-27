module.exports = {
  "env": {
    "node": true
  },
  "extends": [
    "eslint:recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended"
  ],
  "parserOptions": {
    "ecmaVersion": 'latest',
    "sourceType": "module",
    "ecmaFeatures": {
      "jsx": true
    }
  },
  "globals": {
    "window": true,
    "document": true,
    "navigator": true,
    "history": true,
    "localStorage": true,
    "Promise": true,
    "FileReader": true,
    "MutationObserver": true,
    "wp": true,
    "mgl_map": true,
    "mgl_settings": true,
    "mwl": true,
    "Event": true,
    "google": true,
  },
  "rules": {
    "no-console": [1, { allow: ["warn", "error"] }],
    "prefer-const": 2,
    "no-var": 2,
    "no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    "no-trailing-spaces": "error",
    "eqeqeq": ["error", "always"],
    "indent": ["error", 2],
    "semi": ["error", "always"],
    "react/react-in-jsx-scope": "off",
    "react/jsx-uses-react": "off",
    "react/prop-types": "off",
    "no-restricted-globals": [
      "error",
      { "name": "alert", "message": "Use NekoModal or NekoNoticeModal instead of a native browser dialog." },
      { "name": "confirm", "message": "Use NekoModal instead of a native browser dialog." },
      { "name": "prompt", "message": "Use NekoModal with a NekoInput instead of a native browser dialog." }
    ],
    "no-restricted-properties": [
      "error",
      { "object": "window", "property": "alert", "message": "Use NekoModal or NekoNoticeModal instead." },
      { "object": "window", "property": "confirm", "message": "Use NekoModal instead." },
      { "object": "window", "property": "prompt", "message": "Use NekoModal with a NekoInput instead." }
    ]
  },
  "settings": {
    "react": {
      "version": "detect"
    }
  }
};
