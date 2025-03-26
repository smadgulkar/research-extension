const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  mode: 'development',
  devtool: 'source-map',
  entry: {
    popup: './src/popup/index.tsx',
    background: './src/background.ts'
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
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
            const manifest = JSON.parse(content);
            delete manifest.host_permissions;
            delete manifest.content_scripts;
            if (manifest.web_accessible_resources) {
              manifest.web_accessible_resources[0].matches = [];
            }
            return JSON.stringify(manifest, null, 2);
          }
        },
        { 
          from: 'public/popup.html',
          to: 'popup.html'
        },
        { 
          from: 'src/styles',
          to: 'styles'
        },
        { 
          from: 'src/icons/icon48.png',
          to: 'icon48.png'
        },
        { 
          from: 'src/icons/icon128.png',
          to: 'icon128.png'
        }
      ],
    }),
  ],
};