// src/utils/thermalPrinter.ts
// Bluetooth (BLE) link to a generic 58mm ESC/POS thermal printer.
// iOS only exposes generic thermal printers through BLE GATT (Bluetooth
// Classic/SPP needs MFi), and the same GATT path works on Android, so a
// single BLE implementation covers both platforms. The printer exposes a
// writable characteristic; raster bytes are streamed to it in MTU-sized
// chunks with a small delay so the printer's buffer never overflows.
import { PermissionsAndroid, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BleManager, Device, Characteristic, State } from 'react-native-ble-plx';
import { Buffer } from 'buffer';

const STORAGE_ID = 'thermalPrinterId';
const STORAGE_NAME = 'thermalPrinterName';

// Standard GATT services that never hold the printer's write pipe.
const GENERIC_SERVICES = /^0000(1800|1801|180a|180f)-/i;

export interface FoundPrinter {
  id: string;
  name: string;
}

let managerInstance: BleManager | null = null;
function getManager(): BleManager {
  if (!managerInstance) {
    managerInstance = new BleManager();
  }
  return managerInstance;
}

/** Ask for the platform's Bluetooth permissions. Throws with a user-readable
 *  Spanish message when denied so callers can Alert it directly. */
export async function ensureBlePermissions(): Promise<void> {
  if (Platform.OS === 'android') {
    const api = Number(Platform.Version);
    if (api >= 31) {
      const res = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      ]);
      const denied = Object.values(res).some(
        v => v !== PermissionsAndroid.RESULTS.GRANTED,
      );
      if (denied) {
        throw new Error('Se necesita el permiso de Bluetooth para imprimir.');
      }
    } else {
      // BLE scanning on Android 11 and below requires location permission.
      const res = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      );
      if (res !== PermissionsAndroid.RESULTS.GRANTED) {
        throw new Error(
          'Se necesita el permiso de ubicación para buscar la impresora Bluetooth.',
        );
      }
    }
  }
  // iOS: the system prompts on first BLE use via NSBluetoothAlwaysUsageDescription.
}

/** Resolve when the radio is on; throws a Spanish message if it stays off. */
export async function waitForBluetoothOn(timeoutMs = 5000): Promise<void> {
  const manager = getManager();
  const state = await manager.state();
  if (state === State.PoweredOn) return;
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      sub.remove();
      reject(new Error('Bluetooth está apagado. Actívalo e intenta de nuevo.'));
    }, timeoutMs);
    const sub = manager.onStateChange(s => {
      if (s === State.PoweredOn) {
        clearTimeout(timer);
        sub.remove();
        resolve();
      }
    }, true);
  });
}

/** Scan for nearby named BLE devices for `seconds`, reporting incrementally. */
export function scanForPrinters(
  onFound: (printers: FoundPrinter[]) => void,
  seconds = 8,
): () => void {
  const manager = getManager();
  const found = new Map<string, FoundPrinter>();

  manager.startDeviceScan(null, { allowDuplicates: false }, (error, device) => {
    if (error || !device) return;
    const name = device.name || device.localName;
    if (!name) return; // unnamed devices are never the printer the user expects
    if (!found.has(device.id)) {
      found.set(device.id, { id: device.id, name });
      onFound([...found.values()]);
    }
  });

  const stop = () => manager.stopDeviceScan();
  setTimeout(stop, seconds * 1000);
  return stop;
}

export async function getSavedPrinter(): Promise<FoundPrinter | null> {
  const [id, name] = await Promise.all([
    AsyncStorage.getItem(STORAGE_ID),
    AsyncStorage.getItem(STORAGE_NAME),
  ]);
  return id ? { id, name: name || 'Impresora' } : null;
}

export async function savePrinter(printer: FoundPrinter): Promise<void> {
  await AsyncStorage.setItem(STORAGE_ID, printer.id);
  await AsyncStorage.setItem(STORAGE_NAME, printer.name);
}

export async function forgetPrinter(): Promise<void> {
  await AsyncStorage.multiRemove([STORAGE_ID, STORAGE_NAME]);
}

// The write characteristic differs between printer brands (FFE1, 2AF1, FF02…),
// so instead of hardcoding one, pick the first writable characteristic outside
// the generic GATT services — that is the printer's data pipe on every common
// 58mm BLE model.
async function findWritableCharacteristic(
  device: Device,
): Promise<{ char: Characteristic; withoutResponse: boolean }> {
  const services = await device.services();
  let fallback: Characteristic | null = null;
  for (const service of services) {
    if (GENERIC_SERVICES.test(service.uuid)) continue;
    const chars = await service.characteristics();
    for (const c of chars) {
      if (c.isWritableWithoutResponse) {
        return { char: c, withoutResponse: true };
      }
      if (c.isWritableWithResponse && !fallback) {
        fallback = c;
      }
    }
  }
  if (fallback) return { char: fallback, withoutResponse: false };
  throw new Error('La impresora no aceptó la conexión de impresión.');
}

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

/** Connect to the saved/selected printer and stream the ESC/POS bytes. */
export async function printEscPos(
  printerId: string,
  data: Uint8Array,
): Promise<void> {
  const manager = getManager();
  let device: Device | null = null;
  try {
    device = await manager.connectToDevice(printerId, { timeout: 10000 });
    device = await device.discoverAllServicesAndCharacteristics();

    if (Platform.OS === 'android') {
      try {
        device = await device.requestMTU(247);
      } catch {
        /* keep default MTU */
      }
    }

    const { char, withoutResponse } = await findWritableCharacteristic(device);
    // ATT write payload is MTU minus 3 header bytes; stay conservative.
    const mtu = device.mtu && device.mtu > 23 ? device.mtu : 23;
    const chunkSize = Math.max(20, Math.min(180, mtu - 3));

    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = Buffer.from(data.subarray(i, i + chunkSize)).toString('base64');
      if (withoutResponse) {
        await char.writeWithoutResponse(chunk);
        // Without ACKs the printer's serial buffer can overrun; pace the writes.
        await sleep(12);
      } else {
        await char.writeWithResponse(chunk);
      }
    }
    // Let the last chunks drain before dropping the link, or the printer
    // stops mid-ticket.
    await sleep(300);
  } finally {
    if (device) {
      manager.cancelDeviceConnection(device.id).catch(() => {});
    }
  }
}
