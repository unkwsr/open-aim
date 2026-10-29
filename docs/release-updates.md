# Desktop releases, installation and removal

The installed Windows app checks `unkwsr/open-aim`'s latest published GitHub release ten seconds after launch, then every six hours while open. It never treats a commit or a merge into `main` as an update. Offline and rate-limit failures do not interrupt training. The notification appears in the lobby and does not take keyboard focus.

Players can update now, skip that version, or snooze automatic checks for seven days. These choices survive restarts. **Check for updates** in settings bypasses both preferences. Portable and source builds can check manually and open the official releases page; automatic replacement is limited to the installed Windows build.

## Publishing a compatible release

1. Bump `app/package.json` and its lockfile to the new `major.minor.patch` version before building. The release tag must match that version, optionally prefixed with `v`.
2. Run the normal Windows build and publish a non-draft, non-prerelease GitHub release with `AimTrainer-Setup.exe` attached. The portable `AimTrainer.exe` can be attached too.
3. GitHub's release asset API must report its SHA-256 `digest`. The app requires this digest, the exact installer name and an official repository download URL. Missing or incomplete assets produce a recoverable error instead of executing an unverified download. No update server, token or `latest.yml` is needed.

Users on versions predating this feature must install a release containing it manually once.

## Installation behavior

The standalone NSIS installer is assisted and offers a destination folder. In-app updates show the current installation folder first and let the player choose another existing application folder or an empty folder. Unrelated nonempty folders and drive roots are rejected.

The download runs in the main process, is cancellable, has a ten-minute deadline and a bounded size, and is verified against the release's size and SHA-256 before execution. Chromium storage is flushed before handing off. NSIS receives `/S --updated --force-run /D=<selected folder>` with `/D` last and unquoted, as required by NSIS. No shell is used. The installer replaces the app, retains its AppData and relaunches it. Windows security/UAC prompts, if applicable, remain controlled by Windows. A successful installer handoff closes the app; later installer failures are handled by NSIS.

Installer downloads are kept in the profile's `update-downloads` folder. Failed and cancelled downloads are removed immediately; successful handoff folders older than a day are cleaned at a later app launch, so cleanup cannot interfere with the running installer.

## Uninstallation behavior

The custom uninstall page defaults to keeping settings and training data for a future reinstall. Choosing deletion removes the current user's `%APPDATA%\AimTrainer`, the legacy `%APPDATA%\aim-trainer` profile and `%APPDATA%\AimTrainer-Backups`. Exported backups elsewhere and VALORANT files are untouched. Silent upgrades skip this page and never run the custom deletion branch. Keep `deleteAppDataOnUninstall: false` so routine silent upgrades retain data.

## Checks

Run `npm run test:updates` from `app/` for release selection, persistent preferences, cancellation/retry, download verification, safe directory selection and installer handoff tests. The handoff tests inject a fake launcher and never replace the installed application. Run the normal Windows NSIS build to compile the custom installer and uninstaller pages.
