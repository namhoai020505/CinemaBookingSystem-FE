export type ConfirmPopupOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
};

export type ConfirmPopupRequest = Required<Pick<ConfirmPopupOptions, "message">> &
  Omit<ConfirmPopupOptions, "message"> & {
    resolve: (confirmed: boolean) => void;
  };

type ConfirmPopupListener = (request: ConfirmPopupRequest) => void;

let listener: ConfirmPopupListener | null = null;
const pendingRequests: ConfirmPopupRequest[] = [];

export const confirmWithPopup = (
  options: ConfirmPopupOptions | string,
): Promise<boolean> =>
  new Promise((resolve) => {
    const request: ConfirmPopupRequest =
      typeof options === "string"
        ? { message: options, resolve }
        : { ...options, resolve };

    if (listener) {
      listener(request);
      return;
    }

    pendingRequests.push(request);
  });

export const subscribeConfirmPopup = (nextListener: ConfirmPopupListener) => {
  listener = nextListener;

  while (pendingRequests.length > 0) {
    const request = pendingRequests.shift();
    if (request) {
      nextListener(request);
    }
  }

  return () => {
    if (listener === nextListener) {
      listener = null;
    }
  };
};
