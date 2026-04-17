import { Capacitor } from '@capacitor/core';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';

const BACKUP_FOLDER = 'ShopkeeperLedger_Backups';
const MAX_BACKUPS = 7;
const BACKUP_HOUR = 2; // 2 AM default

const COLLECTIONS = ['ledger_entries', 'transactions', 'inventory', 'parties', 'vehicles', 'expenses', 'settings'];

export const AutoBackupService = {
  /**
   * Create a full backup and save to device Documents folder (native only)
   */
  createLocalBackup: async (userId: string, label?: string) => {
    if (!Capacitor.isNativePlatform()) {
      return { success: false, message: 'Auto-backup only available on Android/iOS' };
    }

    const backupData: any = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      userId,
      data: {}
    };

    for (const colName of COLLECTIONS) {
      const colRef = collection(db, `users/${userId}/${colName}`);
      const snap = await getDocs(colRef);
      backupData.data[colName] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }

    const dateStr = new Date().toISOString().split('T')[0];
    const timeStr = new Date().toTimeString().split(' ')[0].replace(/:/g, '');
    const fileName = label
      ? `backup_${label}_${dateStr}.json`
      : `backup_${dateStr}_${timeStr}.json`;

    const filePath = `${BACKUP_FOLDER}/${fileName}`;

    try {
      const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');

      try {
        await Filesystem.mkdir({
          path: BACKUP_FOLDER,
          directory: Directory.Documents,
          recursive: true
        });
      } catch (_) {
        // Folder may already exist
      }

      await Filesystem.writeFile({
        path: filePath,
        data: JSON.stringify(backupData, null, 2),
        directory: Directory.Documents,
        encoding: Encoding.UTF8
      });

      return { success: true, fileName, message: `Backup saved: ${fileName}` };
    } catch (e: any) {
      console.error('Auto backup failed:', e);
      return { success: false, message: e.message || 'Backup failed' };
    }
  },

  /**
   * Rotate old backups, keeping only the last MAX_BACKUPS (native only)
   */
  rotateBackups: async () => {
    if (!Capacitor.isNativePlatform()) return 0;

    try {
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      const result = await Filesystem.readdir({
        path: BACKUP_FOLDER,
        directory: Directory.Documents
      });

      const backupFiles = result.files
        .filter(f => f.name.startsWith('backup_') && f.name.endsWith('.json'))
        .sort((a, b) => (a.name > b.name ? -1 : 1));

      const toDelete = backupFiles.slice(MAX_BACKUPS);
      for (const file of toDelete) {
        await Filesystem.deleteFile({
          path: `${BACKUP_FOLDER}/${file.name}`,
          directory: Directory.Documents
        });
      }

      return toDelete.length;
    } catch (e) {
      console.error('Rotation failed:', e);
      return 0;
    }
  },

  /**
   * List all available backups (native only)
   */
  listBackups: async () => {
    if (!Capacitor.isNativePlatform()) return [];

    try {
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      const result = await Filesystem.readdir({
        path: BACKUP_FOLDER,
        directory: Directory.Documents
      });

      return result.files
        .filter(f => f.name.startsWith('backup_') && f.name.endsWith('.json'))
        .sort((a, b) => (a.name > b.name ? -1 : 1))
        .map(f => ({
          name: f.name,
          date: f.name.match(/backup_(\d{4}-\d{2}-\d{2})/)?.[1] || 'Unknown',
          size: f.size
        }));
    } catch (_) {
      return [];
    }
  },

  /**
   * Restore from a specific backup file (native only)
   */
  restoreFromFile: async (fileName: string) => {
    if (!Capacitor.isNativePlatform()) throw new Error('Restore from file is only available on Android/iOS');

    try {
      const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
      const result = await Filesystem.readFile({
        path: `${BACKUP_FOLDER}/${fileName}`,
        directory: Directory.Documents,
        encoding: Encoding.UTF8
      });

      return JSON.parse(result.data as string);
    } catch (e: any) {
      console.error('Restore read failed:', e);
      throw new Error('Could not read backup file');
    }
  },

  /**
   * Manual backup for a specific day label
   */
  createManualBackup: async (userId: string, dayLabel: string) => {
    return AutoBackupService.createLocalBackup(userId, dayLabel);
  },

  /**
   * Schedule check — call this on app start (native only).
   * Uses localStorage to track last backup date to avoid duplicates.
   */
  checkAndRunDailyBackup: async (userId: string) => {
    if (!Capacitor.isNativePlatform()) return null;

    const LAST_BACKUP_KEY = 'last_auto_backup_date';
    const today = new Date().toISOString().split('T')[0];
    const currentHour = new Date().getHours();

    let lastBackup: string | null = null;
    try { lastBackup = localStorage.getItem(LAST_BACKUP_KEY); }
    catch (_) { try { lastBackup = sessionStorage.getItem(LAST_BACKUP_KEY); } catch (__) {} }

    if (lastBackup === today) return null;
    if (currentHour < BACKUP_HOUR) return null;

    try {
      const result = await AutoBackupService.createLocalBackup(userId);
      if (result.success) {
        try { localStorage.setItem(LAST_BACKUP_KEY, today); }
        catch (_) { try { sessionStorage.setItem(LAST_BACKUP_KEY, today); } catch (__) {} }
        await AutoBackupService.rotateBackups();
      }
      return result;
    } catch (e) {
      console.error('Daily auto-backup error:', e);
      return null;
    }
  }
};
