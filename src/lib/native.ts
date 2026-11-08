// Small bridges for the Android app (Capacitor). Everything is loaded lazily and
// only when running inside the native shell, so the website bundle is unaffected.
import { closeModal, setTab, settleConfirm, toast, useApp, L } from './store';

type CapWindow = { Capacitor?: { isNativePlatform?: () => boolean } };
export const isNative = () => !!(window as unknown as CapWindow).Capacitor?.isNativePlatform?.();

/** Android back button: close a popup → go Home → leave the app. */
export async function initNative() {
  if (!isNative()) return;
  const { App } = await import('@capacitor/app');
  App.addListener('backButton', () => {
    const s = useApp.getState();
    if (s.confirmReq) return settleConfirm(false);
    if (s.modal && s.modal.type !== 'username') return closeModal();
    if (s.tab !== 'cal') return setTab('cal');
    void App.exitApp();
  });
}

/** Saves a base64 file to the phone's Documents folder (used by the Excel export). */
export async function saveFileNative(name: string, base64: string) {
  const { Filesystem, Directory } = await import('@capacitor/filesystem');
  try {
    await Filesystem.writeFile({ path: name, data: base64, directory: Directory.Documents, recursive: true });
    toast(L(`📤 Documents ফোল্ডারে সেভ হয়েছে: ${name}`, `📤 Saved to Documents: ${name}`), 4000);
  } catch {
    await Filesystem.writeFile({ path: name, data: base64, directory: Directory.Data, recursive: true });
    toast(L(`📤 অ্যাপের ফোল্ডারে সেভ হয়েছে: ${name}`, `📤 Saved in the app folder: ${name}`), 4000);
  }
}
