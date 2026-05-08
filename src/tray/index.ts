import { appendFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  app,
  Menu,
  nativeImage,
  Notification,
  Tray,
  type MenuItemConstructorOptions
} from 'electron';
import { loadConfig } from '../config/env.js';
import { startPresenceSync } from '../services/presenceSyncService.js';
import { logger } from '../utils/logger.js';

type StopPresenceSync = () => Promise<void>;

let tray: Tray | null = null;
let stopPresenceSync: StopPresenceSync | null = null;
let isStarting = false;
let isQuitting = false;
let lastStatus = 'Stopped';
let trayLogPath = join(tmpdir(), 'musiccord-tray.log');
let currentMenu: ReturnType<typeof Menu.buildFromTemplate> | null = null;

const writeTrayLog = (message: string, error?: unknown): void => {
  const detail = error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : String(error ?? '');
  const line = `[${new Date().toISOString()}] ${message}${detail ? ` ${detail}` : ''}\n`;

  try {
    if (trayLogPath) {
      appendFileSync(trayLogPath, line);
    }
  } catch {
    // Logging must never keep the tray app from starting.
  }
};

const getPackagedAssetPath = (assetPath: string): string | null => {
  const electronProcess = process as NodeJS.Process & { resourcesPath?: string };
  if (!electronProcess.resourcesPath) {
    return null;
  }

  const unpackedPath = join(electronProcess.resourcesPath, 'app.asar.unpacked', assetPath);
  if (existsSync(unpackedPath)) {
    return unpackedPath;
  }

  const resourcePath = join(electronProcess.resourcesPath, assetPath);
  return existsSync(resourcePath) ? resourcePath : null;
};

const getTrayIconPath = (): string =>
  getPackagedAssetPath('assets/musiccord-tray.ico') ??
  fileURLToPath(new URL('../../assets/musiccord-tray.ico', import.meta.url));

const createTrayIcon = () => {
  const iconPath = getTrayIconPath();
  const icon = nativeImage.createFromPath(iconPath);
  writeTrayLog(`Tray icon loaded: ${iconPath}; empty=${icon.isEmpty()}`);
  return icon;
};

const refreshMenu = (): void => {
  if (!tray) {
    return;
  }

  const isRunning = Boolean(stopPresenceSync);
  const template: MenuItemConstructorOptions[] = [
    {
      label: `MusicCord: ${lastStatus}`,
      enabled: false
    },
    { type: 'separator' },
    {
      label: 'Start Presence',
      enabled: !isRunning && !isStarting,
      click: () => {
        void startTrayPresence();
      }
    },
    {
      label: 'Stop Presence',
      enabled: isRunning,
      click: () => {
        void stopTrayPresence('Stopped');
      }
    },
    {
      label: 'Restart Presence',
      enabled: isRunning && !isStarting,
      click: () => {
        void restartTrayPresence();
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        void quitTrayApp();
      }
    }
  ];

  tray.setToolTip(`MusicCord - ${lastStatus}`);
  currentMenu = Menu.buildFromTemplate(template);
  tray.setContextMenu(currentMenu);
};

const showTrayMenu = (): void => {
  if (!tray || !currentMenu) {
    return;
  }

  tray.popUpContextMenu(currentMenu);
  writeTrayLog('Tray context menu opened');
};

const showStartedNotification = (): void => {
  if (!Notification.isSupported()) {
    writeTrayLog('Windows notification is not supported');
    return;
  }

  const notification = new Notification({
    title: 'MusicCord',
    body: 'MusicCord started successfully!',
    icon: getTrayIconPath()
  });

  notification.on('click', showTrayMenu);
  notification.show();
  writeTrayLog('Started notification shown');
};

const startTrayPresence = async (): Promise<void> => {
  if (stopPresenceSync || isStarting) {
    return;
  }

  isStarting = true;
  lastStatus = 'Starting';
  refreshMenu();

  try {
    const config = loadConfig();
    stopPresenceSync = await startPresenceSync(config);
    lastStatus = 'Running';
  } catch (error) {
    logger.error('tray', 'Failed to start presence sync', error);
    stopPresenceSync = null;
    lastStatus = 'Start failed';
  } finally {
    isStarting = false;
    refreshMenu();
  }
};

const stopTrayPresence = async (status: string): Promise<void> => {
  const stop = stopPresenceSync;
  stopPresenceSync = null;

  if (!stop) {
    lastStatus = status;
    refreshMenu();
    return;
  }

  lastStatus = 'Stopping';
  refreshMenu();

  try {
    await stop();
    lastStatus = status;
  } catch (error) {
    logger.error('tray', 'Failed to stop presence sync', error);
    lastStatus = 'Stop failed';
  } finally {
    refreshMenu();
  }
};

const restartTrayPresence = async (): Promise<void> => {
  await stopTrayPresence('Stopped');
  await startTrayPresence();
};

const quitTrayApp = async (): Promise<void> => {
  if (isQuitting) {
    return;
  }

  isQuitting = true;
  await stopTrayPresence('Stopped');
  tray?.destroy();
  tray = null;
  app.quit();
};

app.setAppUserModelId('MusicCord');
writeTrayLog('Tray main loaded');

process.on('uncaughtException', (error) => {
  writeTrayLog('Uncaught exception', error);
});

process.on('unhandledRejection', (error) => {
  writeTrayLog('Unhandled rejection', error);
});

if (!app.requestSingleInstanceLock()) {
  writeTrayLog('Second instance detected, exiting');
  app.exit(0);
}

app.on('window-all-closed', () => {
  // Keep the tray app alive without any windows.
});

app.on('before-quit', () => {
  isQuitting = true;
});

const initializeTray = (): void => {
  trayLogPath = join(app.getPath('userData'), 'tray.log');
  writeTrayLog('Electron app ready');

  tray = new Tray(createTrayIcon());
  writeTrayLog('Tray instance created');
  refreshMenu();
  showStartedNotification();
  void startTrayPresence();
};

void app.whenReady().then(initializeTray).catch((error: unknown) => {
  writeTrayLog('Failed to initialize tray', error);
});
