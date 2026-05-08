declare module 'electron' {
  export type MenuItemConstructorOptions = Readonly<{
    label?: string;
    type?: 'separator';
    enabled?: boolean;
    checked?: boolean;
    click?: () => void | Promise<void>;
  }>;

  export type NativeImage = Readonly<{
    isEmpty: () => boolean;
    resize: (options: { width?: number; height?: number }) => NativeImage;
  }>;

  type NotificationConstructorOptions = Readonly<{
    title: string;
    body?: string;
    icon?: string | NativeImage;
    silent?: boolean;
  }>;

  export const app: {
    whenReady: () => Promise<void>;
    getPath: (name: 'userData') => string;
    requestSingleInstanceLock: () => boolean;
    on: (event: 'before-quit' | 'window-all-closed' | 'activate', listener: () => void) => void;
    quit: () => void;
    exit: (exitCode?: number) => void;
    setAppUserModelId: (id: string) => void;
  };

  export const Menu: {
    buildFromTemplate: (template: MenuItemConstructorOptions[]) => unknown;
  };

  export const nativeImage: {
    createFromDataURL: (dataUrl: string) => NativeImage;
    createFromPath: (path: string) => NativeImage;
  };

  export class Tray {
    public constructor(image: NativeImage);
    public setToolTip(toolTip: string): void;
    public setContextMenu(menu: unknown): void;
    public popUpContextMenu(menu?: unknown): void;
    public displayBalloon(options: { title: string; content: string; icon?: NativeImage }): void;
    public destroy(): void;
  }

  export class Notification {
    public static isSupported(): boolean;
    public constructor(options: NotificationConstructorOptions);
    public show(): void;
    public on(event: 'click', listener: () => void): void;
  }
}
