const { AndroidConfig } = require("expo/config-plugins");

function withAndroidPostNotifications(config) {
  return AndroidConfig.Permissions.withPermissions(config, [
    "android.permission.POST_NOTIFICATIONS",
  ]);
}

module.exports = withAndroidPostNotifications;
