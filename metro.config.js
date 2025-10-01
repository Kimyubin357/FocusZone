// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// 폰트 파일 처리를 위한 설정 추가
config.resolver.assetExts.push('ttf', 'otf', 'woff', 'woff2');

module.exports = config;
