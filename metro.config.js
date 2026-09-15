const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const config = getDefaultConfig(__dirname);
config.cacheVersion = path.basename(__dirname);

module.exports = config;
