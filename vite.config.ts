import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig} from 'vite';

function syncCpanelReleasePlugin() {
  return {
    name: 'sync-cpanel-release',
    closeBundle() {
      try {
        const distDir = path.resolve(__dirname, 'dist');
        const releaseDir = path.resolve(__dirname, 'cpanel_release');
        if (!fs.existsSync(distDir)) return;

        fs.mkdirSync(releaseDir, {recursive: true});

        // Copy dist/index.html -> cpanel_release/index.html
        const distIndex = path.join(distDir, 'index.html');
        if (fs.existsSync(distIndex)) {
          fs.copyFileSync(distIndex, path.join(releaseDir, 'index.html'));
        }

        // Clean and copy dist/assets -> cpanel_release/assets (excluding aistudio runtime script)
        const distAssets = path.join(distDir, 'assets');
        const releaseAssets = path.join(releaseDir, 'assets');
        if (fs.existsSync(releaseAssets)) {
          fs.rmSync(releaseAssets, {recursive: true, force: true});
        }
        if (fs.existsSync(distAssets)) {
          fs.mkdirSync(releaseAssets, {recursive: true});
          for (const entry of fs.readdirSync(distAssets, {withFileTypes: true})) {
            if (entry.name === 'aistudio') continue;
            const srcPath = path.join(distAssets, entry.name);
            const destPath = path.join(releaseAssets, entry.name);
            if (entry.isFile()) {
              fs.copyFileSync(srcPath, destPath);
            }
          }
        }
      } catch (err) {
        console.warn('sync-cpanel-release warning:', err);
      }
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), syncCpanelReleasePlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/xlsx') || id.includes('node_modules/cfb') || id.includes('node_modules/ssf')) {
              return 'xlsx';
            }
            if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/') || id.includes('node_modules/scheduler')) {
              return 'vendor';
            }
          },
        },
      },
    },
  };
});

