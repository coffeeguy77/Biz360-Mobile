const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

config.resolver.unstable_enableSymlinks = true;

// Exclude churny/hidden dirs from Metro's file crawler + watcher.
// watchFolders includes the whole workspace root, which on Replit contains
// agent scratch dirs (.local/skills/…) whose temp files appear and vanish
// mid-crawl — Metro's FallbackWatcher then throws ENOENT and crashes on start
// (Error: watch '…/.local/skills/.old-llm-query-…'). Also keeps the original
// react-native-webview _tmp_ block. Single combined RegExp so it's guaranteed
// to be used as metro-file-map's ignorePattern (the watcher honours this).
config.resolver.blockList = /\/node_modules\/.*_tmp_\d+\/|\/\.(?:local|cache|upm|git|config)\//;

module.exports = config;
