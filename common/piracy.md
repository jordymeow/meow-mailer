# Anti-Piracy Integration Guide

Comprehensive multi-layer protection system to prevent plugin piracy.

## How It Works

**Layer 1: Build Integrity Check**
Webpack calculates a checksum at build time → PHP provides same checksum at runtime → JavaScript validates → If files are modified, `isRegistered` becomes `false` and all pro features are disabled.

**Layer 2: License Format Validation**
JavaScript validates license keys are exactly 32 hexadecimal characters (MD5 format). Invalid formats are detected, but only flagged as piracy if they lack an 'issue' field (meaning they were forced into the database, not entered through the UI).

**Layer 3: Delayed License Trap**
After 30 seconds, a background check validates the license format again. Invalid licenses WITHOUT an 'issue' field (pirated) are flagged in localStorage for 8 hours. User-entered wrong licenses (with 'issue' field from server validation) are NOT flagged, preventing false positives while still catching pirates.

**Layer 4: Unique Class Names**
Each plugin uses a `[PREFIX]` placeholder system to generate unique class names (`MeowKit_MWAI_Admin`, `MeowKit_MFRH_Admin`, etc.), preventing conflicts when multiple plugins are active and ensuring each plugin loads its own version of common classes.

---

## Integration Steps

### 1. Add Webpack Plugin

**In `webpack.config.js`:**

```javascript
const PiracyCheckPlugin = require('./common/js/webpack-piracy-plugin');

// In your plugins array:
plugins: [
  new PiracyCheckPlugin(),
  // ... other plugins
]
```

### 2. Add Plugin PREFIX to plugins.conf

**In `~/plugins/plugins.conf`:**

```bash
declare -A PLUGIN_PREFIXES=(
  ["your-plugin-name"]="yourprefix"
  ["ai-engine-pro"]="mwai"
  ["media-file-renamer-pro"]="mfrh"
  # ... other plugins
)
```

**Important:** Use the same PREFIX constant defined in your main plugin file (e.g., `MWAI_PREFIX`, `MFRH_PREFIX`).

### 3. Update Autoloader in classes/init.php

**Add MeowKit class autoloading:**

```php
else if ( strpos( $class, 'MeowKit_' ) !== false ) {
  // Strip MeowKit_{PREFIX}_ to get just the class name
  $filename = str_replace( 'meowkit_yourprefix_', '', strtolower( $class ) );
  $filename = str_replace( '_', '-', $filename );
  $file = YOUR_PATH . '/common/' . $filename . '.php';
}
else if ( strpos( $class, 'MeowKitPro_' ) !== false ) {
  // Strip MeowKitPro_{PREFIX}_ to get just the class name
  $filename = str_replace( 'meowkitpro_yourprefix_', '', strtolower( $class ) );
  // ... handle special cases and file path
}
```

**Note:** `check.sh` will automatically update this when you run it, but you need the structure in place.

### 4. Add Build Reference to Localized Data

**In your admin class** (e.g., `classes/admin.php`):

```php
// Get build reference
$build_ref = null;
if ( class_exists( 'MeowKitPro_' . strtoupper(YOUR_PREFIX) . '_Integrity' ) ) {
  $integrity_class = 'MeowKitPro_' . strtoupper(YOUR_PREFIX) . '_Integrity';
  $integrity = new $integrity_class( YOUR_PREFIX, YOUR_PATH );
  $build_ref = $integrity->get_build_ref( YOUR_VERSION );
}

$localize_data = [
  // ... your existing data
  'build_ref' => $build_ref,
  // ... rest of data
];
```

**Important:** Pass your plugin's root path as the second parameter (e.g., `MWAI_PATH`, `MFRH_PATH`) so each plugin checks its own files, not another plugin's files.

### 5. Check Integrity in Settings

**In your `settings.js`** (or wherever `isRegistered` is defined):

```javascript
import { checkIntegrity } from '@common/integrity-checker';

const isPro = window.yourData.is_pro;
const isRegistered = isPro && checkIntegrity() && window.yourData.is_registered;

export { isPro, isRegistered };
```

### 6. Run check.sh

**From `~/plugins/`:**

```bash
cd ~/plugins
./check.sh
```

This will automatically:
- Copy common folder to each plugin
- Replace `[PREFIX]` placeholder with each plugin's actual prefix
- Update all MeowCommon class references in plugin files
- Fix autoloader to handle the prefixed class names
- Process both `~/plugins/` and `~/Documents/Coding/plugins/` locations

**That's it!** The system is now active:
- Build integrity checks validate file checksums
- License format validation runs immediately in the UI
- Delayed trap flags invalid licenses after 30 seconds
- Each plugin has unique class names to avoid conflicts

---

## Testing

### Layer 1: Build Integrity
1. **Build**: `pnpm build`
2. **Test genuine**: Refresh admin - pro features work
3. **Test modified**: Edit any checked PHP file (e.g., `common/premium/licenser.php`), refresh - integrity check fails
4. **Restore**: Undo change - everything works again

### Layer 2 & 3: License Validation
1. **Test invalid license immediately**: Enter `**********` (10 asterisks) as license
   - Should show error: "This copy does not match the official release"
   - Happens instantly in the UI

2. **Test delayed trap**: Wait 30 seconds after page load
   - Invalid license gets flagged in localStorage
   - Persists for 8 hours even after page refresh
   - Clear with: `localStorage.clear()` in browser console

3. **Test recovery window**: Enter a valid license
   - System removes localStorage flag
   - Pro features re-enable immediately
   - 8-hour window allows legitimate purchasers to recover

---

## Customization

**To check different files**, edit both `common/js/webpack-piracy-plugin.js` and `common/premium/integrity.php`:

```javascript
this.files = [
  'common/premium/licenser.php',
  'your/custom/file.php',
];
```

**To change encryption key**, generate a random key and update both `common/js/webpack-piracy-plugin.js` and `common/js/integrity-checker.js`:

```bash
# Generate random key
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

Then use that random string in both files:

```javascript
const key = '9e1b6a5b15119ef7699943e6210b36e1'; // Replace with your random key
```

**Important:** Both files must use the exact same key.

---

## The [PREFIX] Placeholder System

The common folder uses `[PREFIX]` placeholders that get replaced by `check.sh`:

**Source (~/plugins/common/):**
```php
class MeowKit_[PREFIX]_Admin {
  // ...
}
```

```javascript
window.[PREFIX]?.rest_url
window.[PREFIX]?.is_pro
```

**After check.sh (per plugin):**
- AI Engine: `MeowKit_MWAI_Admin`, `window.MWAI`
- Media File Renamer: `MeowKit_MFRH_Admin`, `window.MFRH`
- SEO Engine: `MeowKit_MWSEO_Admin`, `window.MWSEO`

This ensures:
- No class name conflicts between plugins
- Each plugin uses its own license/settings data
- Proper autoloading with unique prefixes

**Checksum validation:** `checksum.sh` normalizes all PREFIX variations back to `[PREFIX]` before calculating checksums, so plugins still match the source even though they're customized.

---

## Files Used

All these files are shared in `/common/` across all plugins:

- `/common/js/webpack-piracy-plugin.js` - Webpack plugin for build checksums
- `/common/js/integrity-checker.js` - Client-side validator with license format check and delayed trap
- `/common/premium/integrity.php` - Server-side checksum validation
- `/common/js/components/LicenseBlock.js` - UI component with immediate license validation
- `/common/checksum.sh` - Development tool to verify common folder integrity (normalizes PREFIX)

**Note:** check.sh customizes these files automatically for each plugin.

## How Crackers Are Defeated

### Timeline for Cracked Versions

**Minute 0: Initial Install**
- Cracker modifies main plugin file to inject fake license
- Plugin appears to work (validation hasn't run yet)
- Pro features are enabled

**30 Seconds: Delayed Trap Triggers**
- Background JavaScript validates license format
- Fake license (e.g., `**********`) detected as invalid
- License key flagged in localStorage with timestamp
- Pro features still appear to work (for now)

**Next Page Load: Trap Activates**
- `checkIntegrity()` checks localStorage for flagged license
- Finds flag from 30 seconds ago, still within 8-hour window
- `integrityFailed = true`
- Pro features disabled
- Error message: "This copy does not match the official release..."

**Every Subsequent Load: Endless Cycle**
- Flag persists in localStorage for 8 hours
- Even if cracker clears it, the delayed trap sets it again after 30 seconds
- Creates an endless cycle of flagging and re-flagging
- Cracker must either:
  - Clear localStorage every 30 seconds (impossible to distribute)
  - Modify the JavaScript (but it's compiled/minified)
  - Give up and buy a license

### Timeline for Legitimate Users

**Minute 0: Purchased License**
- User buys plugin, receives valid 32-character hex license key
- Enters license key in admin panel
- Passes format validation immediately (32 hex chars)

**30 Seconds: Delayed Check Passes**
- Background JavaScript validates license format
- Valid format (32 hex chars) passes check
- No localStorage flag set
- Everything continues working

**Forever: No Issues**
- Valid license never gets flagged
- No localStorage interference
- Smooth user experience

**If Previously Flagged:**
- Enter valid license
- System recognizes valid format
- localStorage flag cleared
- Pro features re-enable immediately
- 8-hour recovery window ensures legitimate purchasers aren't permanently blocked

---

## Protection Against Common Cracks

**Cannot bypass by:**
- ❌ Injecting fake license in PHP (detected by format validation)
- ❌ Clearing localStorage once (re-flagged after 30 seconds)
- ❌ Modifying PHP files (build integrity check fails)
- ❌ Using browser extensions to block localStorage (needed for other features)
- ❌ Disabling JavaScript (breaks entire admin UI)
- ❌ Loading older version of common folder (each plugin has unique classes)

**Could bypass by:**
- ⚠️ Modifying compiled JavaScript (requires webpack expertise, breaks on every update)
- ⚠️ Generating valid-format fake license (still won't work with API, just delays detection)

**Recovery path for legitimate users:**
- ✅ Purchase license
- ✅ Clear localStorage if needed: `localStorage.clear()`
- ✅ Enter valid license
- ✅ Everything works immediately
