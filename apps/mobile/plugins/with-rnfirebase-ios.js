const fs = require("fs");
const path = require("path");
const {
  withDangerousMod,
  withPodfileProperties,
} = require("expo/config-plugins");

const FLAG = "$RNFirebaseAsStaticFramework = true";

function withRnFirebaseIos(config) {
  config = withPodfileProperties(config, (mod) => {
    mod.modResults["ios.useFrameworks"] = "static";
    return mod;
  });

  return withDangerousMod(config, [
    "ios",
    async (mod) => {
      const podfilePath = path.join(
        mod.modRequest.platformProjectRoot,
        "Podfile"
      );
      let contents = fs.readFileSync(podfilePath, "utf8");

      if (!contents.includes(FLAG)) {
        contents = `${FLAG}\n${contents}`;
      }

      contents = contents.replace(
        /  use_frameworks! :linkage => podfile_properties\['ios\.useFrameworks'\]\.to_sym if podfile_properties\['ios\.useFrameworks'\]\n  use_frameworks! :linkage => ENV\['USE_FRAMEWORKS'\]\.to_sym if ENV\['USE_FRAMEWORKS'\]\n/,
        "  use_frameworks! :linkage => :static\n"
      );

      if (!contents.includes("use_frameworks! :linkage => :static")) {
        contents = contents.replace(
          "  use_react_native!(",
          "  use_frameworks! :linkage => :static\n\n  use_react_native!("
        );
      }

      fs.writeFileSync(podfilePath, contents);
      return mod;
    },
  ]);
}

module.exports = withRnFirebaseIos;
