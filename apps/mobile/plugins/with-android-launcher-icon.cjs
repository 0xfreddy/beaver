/* eslint-disable @typescript-eslint/no-require-imports -- Expo loads config plugins through CommonJS. */
const { withAndroidManifest, withDangerousMod } = require('expo/config-plugins');
const fs = require('node:fs/promises');
const path = require('node:path');

// Reuse the original brand artwork without Android's legacy-icon shrink wrap.
// An adaptive layer is 108dp; its normal visible viewport is 72dp. Insetting
// the existing full icon by 18dp places it exactly inside that viewport.
module.exports = function withAndroidLauncherIcon(config) {
  config = withAndroidManifest(config, (mod) => {
    const application = mod.modResults.manifest.application[0].$;
    application['android:icon'] = '@mipmap/beaver_launcher';
    application['android:roundIcon'] = '@mipmap/beaver_launcher';
    return mod;
  });
  return withDangerousMod(config, ['android', async (mod) => {
    const res = path.join(mod.modRequest.platformProjectRoot, 'app/src/main/res');
    await fs.mkdir(path.join(res, 'mipmap-anydpi-v26'), { recursive: true });
    await fs.mkdir(path.join(res, 'drawable'), { recursive: true });
    await fs.writeFile(path.join(res, 'mipmap-anydpi-v26/beaver_launcher.xml'), `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
  <background android:drawable="@android:color/black" />
  <foreground android:drawable="@drawable/beaver_launcher_foreground" />
</adaptive-icon>
`);
    await fs.writeFile(path.join(res, 'drawable/beaver_launcher_foreground.xml'), `<?xml version="1.0" encoding="utf-8"?>
<inset xmlns:android="http://schemas.android.com/apk/res/android"
  android:drawable="@mipmap/ic_launcher_foreground"
  android:inset="16.666667%" />
`);
    return mod;
  }]);
};
