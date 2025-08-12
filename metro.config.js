const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

config.resolver.extraNodeModules = {
  '@components': path.resolve(__dirname, 'components'),
  '@': path.resolve(__dirname, 'app'), // optional, for app alias
};

config.watchFolders = [
  path.resolve(__dirname, 'app'),
  path.resolve(__dirname, 'components'),
];

module.exports = config;
