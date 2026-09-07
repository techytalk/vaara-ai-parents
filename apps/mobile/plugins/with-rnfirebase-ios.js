const fs = require("fs");
const path = require("path");
const { withDangerousMod } = require("expo/config-plugins");

const FLAG = "$RNFirebaseAsStaticFramework = true";

const EXTRA_PODS = `
  # Firebase iOS static frameworks: allow FirebaseInstallations to see FirebaseCore
  pod 'FirebaseCore', :modular_headers => true
  pod 'FirebaseCoreInternal', :modular_headers => true
  pod 'FirebaseInstallations', :modular_headers => true
  pod 'GoogleUtilities', :modular_headers => true
`;

function withRnFirebaseIos(config) {
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

      if (!contents.includes("pod 'FirebaseCore'")) {
        contents = contents.replace(
          /target ['"]VaaraParents['"] do\n/,
          `target 'VaaraParents' do\n${EXTRA_PODS}`
        );
      }

      if (
        !contents.includes(
          "CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES"
        )
      ) {
        contents = contents.replace(
          "post_install do |installer|\n",
          `post_install do |installer|
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |cfg|
        cfg.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
      end
    end
`
        );
      }

      fs.writeFileSync(podfilePath, contents);
      return mod;
    },
  ]);
}

module.exports = withRnFirebaseIos;
