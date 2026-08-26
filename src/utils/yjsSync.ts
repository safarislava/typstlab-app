import { 
  encodeCellsToYjsDelta, 
  decodeYjsDeltaToCells, 
  uint8ArrayToBase64, 
  base64ToUint8Array, 
  encodeYjsStateVector, 
  applyYjsDelta,
  yjsDocManager
} from '../services';

export {
  encodeCellsToYjsDelta,
  decodeYjsDeltaToCells,
  uint8ArrayToBase64,
  base64ToUint8Array,
  encodeYjsStateVector,
  applyYjsDelta
};

export const getOrCreateFileYDoc = yjsDocManager.getOrCreateDoc.bind(yjsDocManager);
export const updateFileYjsState = yjsDocManager.setServerState.bind(yjsDocManager);
