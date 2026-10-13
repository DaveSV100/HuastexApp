// Saving receipt images to the gallery, incl. iOS "add photos only" access.
import { Platform } from 'react-native';

jest.mock('@react-native-camera-roll/camera-roll', () => ({
  CameraRoll: { saveAsset: jest.fn() },
  iosReadGalleryPermission: jest.fn(),
}));

const { CameraRoll, iosReadGalleryPermission } = require('@react-native-camera-roll/camera-roll');
const { saveImageToGallery } = require('../src/utils/gallery');

// What the native module sends after a successful add-only save (no reason).
const unableToSave = () =>
  Object.assign(new Error('Unknown error from a native module'), { code: 'E_UNABLE_TO_SAVE' });
const permissions = (addOnly: string, readWrite: string) =>
  (iosReadGalleryPermission as jest.Mock).mockImplementation((level: string) =>
    Promise.resolve(level === 'addOnly' ? addOnly : readWrite),
  );

beforeEach(() => {
  jest.clearAllMocks();
  Platform.OS = 'ios';
});

describe('saveImageToGallery', () => {
  it('saves normally', async () => {
    (CameraRoll.saveAsset as jest.Mock).mockResolvedValue({});
    await expect(saveImageToGallery('file:///x.png')).resolves.toBeUndefined();
    expect(CameraRoll.saveAsset).toHaveBeenCalledWith('file:///x.png', { type: 'photo' });
  });

  it('counts as saved with iOS add-only access (library cannot read the photo back)', async () => {
    (CameraRoll.saveAsset as jest.Mock).mockRejectedValue(unableToSave());
    permissions('granted', 'denied');
    await expect(saveImageToGallery('file:///x.png')).resolves.toBeUndefined();
  });

  it('still fails when the app has full access (a real save error)', async () => {
    (CameraRoll.saveAsset as jest.Mock).mockRejectedValue(unableToSave());
    permissions('granted', 'granted');
    await expect(saveImageToGallery('file:///x.png')).rejects.toThrow('Unknown error from a native module');
  });

  it('still fails on a real save error with add-only access (Photos reason attached)', async () => {
    const real = Object.assign(
      new Error('The operation couldn’t be completed. (PHPhotosErrorDomain error -1.)'),
      { code: 'E_UNABLE_TO_SAVE' },
    );
    (CameraRoll.saveAsset as jest.Mock).mockRejectedValue(real);
    permissions('granted', 'not-determined');
    await expect(saveImageToGallery('file:///missing.png')).rejects.toThrow('PHPhotosErrorDomain');
  });

  it('still fails when access was denied', async () => {
    const denied = Object.assign(new Error('denied'), { code: 'E_PHOTO_LIBRARY_AUTH_DENIED' });
    (CameraRoll.saveAsset as jest.Mock).mockRejectedValue(denied);
    await expect(saveImageToGallery('file:///x.png')).rejects.toThrow('denied');
    expect(iosReadGalleryPermission).not.toHaveBeenCalled();
  });

  it('never applies the iOS rule on Android', async () => {
    Platform.OS = 'android';
    (CameraRoll.saveAsset as jest.Mock).mockRejectedValue(unableToSave());
    await expect(saveImageToGallery('file:///x.png')).rejects.toThrow();
    expect(iosReadGalleryPermission).not.toHaveBeenCalled();
  });
});
