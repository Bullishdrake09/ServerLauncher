import fetch from 'node-fetch';
import * as fs from 'fs';
import * as path from 'path';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';

export interface MinecraftVersionInfo {
  id: string;
  type: 'release' | 'snapshot' | 'old_beta' | 'old_alpha';
  url: string;
  time: string;
  releaseTime: string;
}

export interface MinecraftVersionsManifest {
  latest: {
    release: string;
    snapshot: string;
  };
  versions: MinecraftVersionInfo[];
}

export class VersionService {
  private readonly manifestUrl = 'https://launchermeta.mojang.com/mc/game/version_manifest.json';
  private cache: MinecraftVersionsManifest | null = null;
  private cacheTime: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  /**
   * Fetch Minecraft version manifest
   */
  async getVersions(forceRefresh: boolean = false): Promise<MinecraftVersionsManifest> {
    const now = Date.now();
    
    if (this.cache && !forceRefresh && (now - this.cacheTime) < this.CACHE_DURATION) {
      return this.cache;
    }

    try {
      const response = await fetch(this.manifestUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch version manifest: ${response.status}`);
      }

      this.cache = await response.json() as MinecraftVersionsManifest;
      this.cacheTime = now;
      return this.cache;
    } catch (error) {
      console.error('Error fetching Minecraft versions:', error);
      throw new Error('Failed to fetch Minecraft versions');
    }
  }

  /**
   * Get available versions filtered by type
   */
  async getAvailableVersions(type?: 'release' | 'snapshot'): Promise<MinecraftVersionInfo[]> {
    const manifest = await this.getVersions();
    
    let versions = manifest.versions;
    if (type) {
      versions = versions.filter(v => v.type === type);
    }

    return versions.slice(0, 100); // Limit to 100 versions
  }

  /**
   * Get the latest release version
   */
  async getLatestRelease(): Promise<string> {
    const manifest = await this.getVersions();
    return manifest.latest.release;
  }

  /**
   * Download server jar for a specific version and type
   */
  async downloadServerJar(
    version: string,
    serverType: 'vanilla' | 'paper' | 'fabric' | 'forge',
    destinationPath: string
  ): Promise<string> {
    let downloadUrl: string;

    switch (serverType) {
      case 'vanilla':
        downloadUrl = await this.getVanillaServerUrl(version);
        break;
      case 'paper':
        downloadUrl = await this.getPaperServerUrl(version);
        break;
      case 'fabric':
        downloadUrl = await this.getFabricServerUrl(version);
        break;
      case 'forge':
        downloadUrl = await this.getForgeServerUrl(version);
        break;
      default:
        throw new Error(`Unknown server type: ${serverType}`);
    }

    console.log(`Downloading ${serverType} server ${version} from ${downloadUrl}`);

    // Ensure destination directory exists
    const destDir = path.dirname(destinationPath);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    // Download the file
    const response = await fetch(downloadUrl);
    if (!response.ok) {
      throw new Error(`Failed to download server jar: ${response.status}`);
    }

    const writer = createWriteStream(destinationPath);
    
    // Handle node-fetch body properly
    const body = response.body;
    if (!body) {
      throw new Error('No response body');
    }

    await pipeline(body, writer);

    return destinationPath;
  }

  /**
   * Get vanilla server download URL
   */
  private async getVanillaServerUrl(version: string): Promise<string> {
    const manifest = await this.getVersions();
    const versionInfo = manifest.versions.find(v => v.id === version);
    
    if (!versionInfo) {
      throw new Error(`Version ${version} not found`);
    }

    // Fetch version-specific manifest
    const response = await fetch(versionInfo.url);
    if (!response.ok) {
      throw new Error(`Failed to fetch version manifest for ${version}`);
    }

    const versionManifest = await response.json();
    return versionManifest.downloads.server.url;
  }

  /**
   * Get PaperMC server download URL
   */
  private async getPaperServerUrl(version: string): Promise<string> {
    // Use PaperMC API v2
    const apiBase = 'https://api.papermc.io/v2/projects/paper';
    
    try {
      // Get available builds for this version
      const versionsResponse = await fetch(`${apiBase}/versions`);
      if (!versionsResponse.ok) {
        throw new Error('Failed to fetch Paper versions');
      }

      const versions = await versionsResponse.json() as string[];
      
      // Find matching version or closest
      let paperVersion = versions.find(v => v === version);
      if (!paperVersion) {
        // Try to find closest match
        paperVersion = versions.find(v => version.startsWith(v)) || versions[versions.length - 1];
      }

      // Get latest build for this version
      const buildsResponse = await fetch(`${apiBase}/versions/${paperVersion}/builds`);
      if (!buildsResponse.ok) {
        throw new Error('Failed to fetch Paper builds');
      }

      const builds = await buildsResponse.json() as { build: number }[];
      const latestBuild = builds[builds.length - 1].build;

      // Get download URL
      const downloadResponse = await fetch(`${apiBase}/versions/${paperVersion}/builds/${latestBuild}/downloads/server`);
      if (!downloadResponse.ok) {
        throw new Error('Failed to get Paper download info');
      }

      const downloadInfo = await downloadResponse.json() as { downloads: { application: { url: string } } };
      return `https://api.papermc.io${downloadInfo.downloads.application.url}`;
    } catch (error) {
      console.error('Error fetching Paper server:', error);
      throw new Error('Failed to get Paper server download URL');
    }
  }

  /**
   * Get Fabric server download URL
   */
  private async getFabricServerUrl(version: string): Promise<string> {
    // Get latest Fabric installer
    const installerResponse = await fetch('https://meta.fabricmc.net/v2/installers/server');
    if (!installerResponse.ok) {
      throw new Error('Failed to fetch Fabric installer info');
    }

    const installerInfo = await installerResponse.json() as { url: string }[];
    
    // For simplicity, download the installer which will then download the server
    // In production, you'd want to run the installer with proper arguments
    return installerInfo[0]?.url || '';
  }

  /**
   * Get Forge server download URL
   */
  private async getForgeServerUrl(version: string): Promise<string> {
    // Forge requires more complex handling - get recommended version
    const promoResponse = await fetch(`https://files.minecraftforge.net/net/minecraftforge/forge/${version}/promotions_slim.json`);
    
    if (!promoResponse.ok) {
      throw new Error('Failed to fetch Forge promotions');
    }

    const promoData = await promoResponse.json() as { promos: Record<string, string> };
    const versionKey = `${version}-recommended`;
    const forgeVersion = promoData.promos[versionKey] || promoData.promos[`${version}-latest`];

    if (!forgeVersion) {
      throw new Error(`No Forge version found for Minecraft ${version}`);
    }

    return `https://maven.minecraftforge.net/net/minecraftforge/forge/${version}-${forgeVersion}/forge-${version}-${forgeVersion}-installer.jar`;
  }

  /**
   * Clear version cache
   */
  clearCache(): void {
    this.cache = null;
    this.cacheTime = 0;
  }
}
