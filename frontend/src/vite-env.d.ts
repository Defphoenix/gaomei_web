/// <reference types="vite/client" />

declare module "igv" {
  export interface BrowserOptions {
    genome?: string | Record<string, unknown>;
    locus?: string;
    tracks?: any[];
    showNavigation?: boolean;
    showRuler?: boolean;
  }

  export interface Browser {
    search(locus: string): Promise<void>;
    loadTrack(config: any): Promise<void>;
    remove(): void;
    genome?: any;
  }

  export function createBrowser(
    container: HTMLElement,
    options: BrowserOptions
  ): Promise<Browser>;
}
