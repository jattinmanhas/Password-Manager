import type { DerivedMasterKey, EncryptedVaultItem } from "./index";
import type { VaultItemResponse } from "../types/vault-api.types";
import type { VaultViewItem } from "../types/vault.types";
import type {
  CryptoWorkerDecryptVaultItemsResponse,
  CryptoWorkerDeriveKeyResponse,
  CryptoWorkerRequestPayload,
  CryptoWorkerResponsePayload,
  CryptoWorkerVerifyVaultKeyResponse,
} from "./worker.types";

type WorkerRequestMessage = {
  id: number;
  payload: CryptoWorkerRequestPayload;
};

type WorkerResponseMessage = {
  id: number;
  ok: true;
  payload: CryptoWorkerResponsePayload;
} | {
  id: number;
  ok: false;
  error: string;
};

let nextRequestId = 1;
let cryptoWorker: Worker | null = null;
const pendingRequests = new Map<number, {
  resolve: (value: CryptoWorkerResponsePayload) => void;
  reject: (error: Error) => void;
}>();

function getCryptoWorker(): Worker {
  if (cryptoWorker) {
    return cryptoWorker;
  }

  cryptoWorker = new Worker(new URL("./crypto.worker.ts", import.meta.url), { type: "module" });
  cryptoWorker.onmessage = (event: MessageEvent<WorkerResponseMessage>) => {
    const message = event.data;
    const request = pendingRequests.get(message.id);
    if (!request) {
      return;
    }

    pendingRequests.delete(message.id);
    if (message.ok) {
      request.resolve(message.payload);
      return;
    }

    request.reject(new Error(message.error));
  };
  cryptoWorker.onerror = (event) => {
    const error = new Error(event.message || "crypto worker crashed");
    for (const request of pendingRequests.values()) {
      request.reject(error);
    }
    pendingRequests.clear();
    cryptoWorker?.terminate();
    cryptoWorker = null;
  };

  return cryptoWorker;
}

function postWorkerRequest<T extends CryptoWorkerResponsePayload>(payload: CryptoWorkerRequestPayload): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = nextRequestId++;
    pendingRequests.set(id, {
      resolve: (value) => resolve(value as T),
      reject,
    });

    const worker = getCryptoWorker();
    const message: WorkerRequestMessage = { id, payload };
    worker.postMessage(message);
  });
}

export async function deriveMasterKeyWithWorker(input: {
  password: string;
  salt?: Uint8Array;
  params?: DerivedMasterKey["params"];
}): Promise<DerivedMasterKey> {
  const response = await postWorkerRequest<CryptoWorkerDeriveKeyResponse>({
    type: "derive-key",
    password: input.password,
    salt: input.salt,
    params: input.params,
  });

  return {
    key: response.key,
    salt: response.salt,
    params: response.params,
  };
}

export async function verifyVaultKeyWithWorker(input: {
  password: string;
  salt: Uint8Array;
  payload: EncryptedVaultItem;
}): Promise<{ verified: boolean; derived: DerivedMasterKey | null }> {
  const response = await postWorkerRequest<CryptoWorkerVerifyVaultKeyResponse>({
    type: "verify-vault-key",
    password: input.password,
    salt: input.salt,
    payload: input.payload,
  });

  return {
    verified: response.verified,
    derived: response.verified && response.key
      ? {
          key: response.key,
          salt: response.salt,
          params: response.params,
        }
      : null,
  };
}

export async function decryptVaultItemsWithWorker(input: {
  items: VaultItemResponse[];
  kek: Uint8Array;
}): Promise<VaultViewItem[]> {
  const response = await postWorkerRequest<CryptoWorkerDecryptVaultItemsResponse>({
    type: "decrypt-vault-items",
    items: input.items,
    kek: input.kek,
  });
  return response.items;
}
