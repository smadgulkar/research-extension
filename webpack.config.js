const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

const isProduction = process.env.NODE_ENV === 'production';
// TARGET: 'chrome' (Chrome Web Store + Edge Add-ons) | 'firefox' (AMO)
const target = process.env.TARGET || 'chrome';
// E2E builds add host permissions so Puppeteer tests can read a local fixture page
// and mock provider APIs. They are written to dist-e2e and are NEVER packaged.
const isE2E = process.env.E2E === '1';
const outDir = isE2E ? 'dist-e2e' : target === 'firefox' ? 'dist-firefox' : 'dist';

// Firefox add-on ID. Fixed forever once the add-on is first submitted to AMO.
const GECKO_ID = 'research-assistant@smadgulkar.github.io';

function transformManifest(manifest) {
  delete manifest.host_permissions;
  delete manifest.content_scripts;
  if (manifest.web_accessible_resources) {
    manifest.web_accessible_resources[0].matches = [];
  }

  if (target === 'firefox') {
    // Firefox MV3 has no background service worker; it uses event-page scripts.
    manifest.background = { scripts: ['background.js'] };
    // Firefox rejects the `extension_ids` key, and with no matches it grants nothing anyway.
    delete manifest.web_accessible_resources;
    manifest.browser_specific_settings = {
      gecko: {
        id: GECKO_ID,
        // data_collection_permissions requires Firefox 140+ (desktop) / 142+ (Android)
        strict_min_version: '140.0',
        // Page content is sent to the AI provider the user picks.
        data_collection_permissions: { required: ['websiteContent'] }
      },
      gecko_android: { strict_min_version: '142.0' }
    };
  }

  if (isE2E) {
    manifest.host_permissions = [
      'http://127.0.0.1/*',
      'http://blog.example.com/*', // screenshots only (scripts/screenshots.js)
      'https://api.openai.com/*',
      'https://api.anthropic.com/*',
      'https://generativelanguage.googleapis.com/*',
      'https://api.notion.com/*'
    ];
  }
  return manifest;
}

module.exports = {
  mode: isProduction ? 'production' : 'development',
  devtool: isProduction ? false : 'source-map',
  entry: {
    popup: './src/popup/index.tsx',
    background: './src/background.ts'
  },
  output: {
    path: path.resolve(__dirname, outDir),
    filename: '[name].js',
    clean: true,
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader', 'postcss-loader'],
      },
      {
        test: /\.(ttf|woff|woff2)$/,
        type: 'asset/resource',
        generator: {
          filename: 'fonts/[name][ext]'
        }
      }
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        {
          from: 'public/manifest.json',
          to: 'manifest.json',
          transform(content) {
            return JSON.stringify(transformManifest(JSON.parse(content)), null, 2);
          }
        },
        { from: 'public/popup.html', to: 'popup.html' },
        { from: 'src/styles', to: 'styles' },
        { from: 'src/icons/icon48.png', to: 'icon48.png' },
        { from: 'src/icons/icon128.png', to: 'icon128.png' },
        { from: path.resolve(__dirname, 'public/fonts'), to: 'fonts' },
        { from: 'src/popup/error-handler.js', to: 'error-handler.js' }
      ],
    }),
  ],
};

// Add bundle analyzer in analyze mode
if (process.env.ANALYZE === 'true') {
  const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
  module.exports.plugins.push(
    new BundleAnalyzerPlugin({
      analyzerMode: 'static',
      reportFilename: 'bundle-report.html',
      openAnalyzer: true,
    })
  );
}
