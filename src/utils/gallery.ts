// src/utils/gallery.ts
// Save a captured image (file uri) to the phone's photo gallery.
import { Platform } from 'react-native';
import { CameraRoll, iosReadGalleryPermission } from '@react-native-camera-roll/camera-roll';

// iOS with "Agregar solo fotos" (add-only) access: the photo IS saved, but
// the camera-roll library then reads the new photo back to return its info,
// which add-only access forbids — so it rejects with E_UNABLE_TO_SAVE even
// though the save worked. That rejection carries no reason (React Native's
// generic "Unknown error from a native module"); a real failure carries the
// Photos error (e.g. "PHPhotosErrorDomain error -1"). Only the reason-less
// rejection while the app can add but not read photos counts as saved.
const savedWithAddOnlyAccess = async (): Promise<boolean> => {
  try {
    const [addOnly, readWrite] = await Promise.all([
      iosReadGalleryPermission('addOnly'),
      iosReadGalleryPermission('readWrite'),
    ]);
    return addOnly === 'granted' && readWrite !== 'granted' && readWrite !== 'limited';
  } catch {
    return false;
  }
};

export async function saveImageToGallery(uri: string): Promise<void> {
  try {
    await CameraRoll.saveAsset(uri, { type: 'photo' });
  } catch (err: any) {
    if (
      Platform.OS === 'ios' &&
      err?.code === 'E_UNABLE_TO_SAVE' &&
      /unknown error/i.test(String(err?.message)) &&
      (await savedWithAddOnlyAccess())
    ) {
      return;
    }
    throw err;
  }
}
