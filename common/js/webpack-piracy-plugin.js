const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

class PiracyCheckPlugin {
  constructor(options = {}) {
    this.files = options.files || [
      'common/premium/licenser.php',
      'common/premium/rest_license.php',
      'common/premium/updater.php'
    ];
  }

  apply(compiler) {
    const isProduction = compiler.options.mode === 'production';

    // Only run in production builds
    if (!isProduction) {
      console.log('[PiracyCheck] Skipped (development mode)');
      return;
    }

    compiler.hooks.emit.tapAsync('PiracyCheckPlugin', (compilation, callback) => {
      try {
        // Calculate checksum
        const checksum = this.calculateChecksum();
        console.log('[PiracyCheck] Calculated checksum:', checksum);

        // Encrypt it
        const encrypted = this.encryptChecksum(checksum);
        console.log('[PiracyCheck] Encrypted checksum:', encrypted);

        // Replace placeholder in all output files
        Object.keys(compilation.assets).forEach(filename => {
          if (filename.endsWith('.js')) {
            let source = compilation.assets[filename].source();

            if (source.includes('[CRYPTED_CHECKSUM_PIRACY]')) {
              source = source.replace(/\[CRYPTED_CHECKSUM_PIRACY\]/g, encrypted);

              compilation.assets[filename] = {
                source: () => source,
                size: () => source.length
              };

              console.log(`[PiracyCheck] Injected encrypted checksum into ${filename}`);
            }
          }
        });

        callback();
      } catch (err) {
        console.error('[PiracyCheck] Error:', err);
        callback(err);
      }
    });
  }

  calculateChecksum() {
    let combined = '';
    const projectRoot = path.join(__dirname, '../../');

    this.files.forEach(file => {
      const filePath = path.join(projectRoot, file);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath);
        combined += crypto.createHash('md5').update(content).digest('hex');
      } else {
        console.warn(`[PiracyCheck] File not found: ${file} (looked at: ${filePath})`);
      }
    });

    // Same algorithm as server: SHA256 of combined MD5s
    return crypto.createHash('sha256').update(combined).digest('hex');
  }

  encryptChecksum(checksum) {
    const key = '9e1b6a5b15119ef7699943e6210b36e1';
    let encrypted = '';

    for (let i = 0; i < checksum.length; i++) {
      const checksumChar = checksum.charCodeAt(i);
      const keyChar = key.charCodeAt(i % key.length);
      const xored = checksumChar ^ keyChar;
      encrypted += xored.toString(16).padStart(2, '0');
    }

    return encrypted;
  }
}

module.exports = PiracyCheckPlugin;
