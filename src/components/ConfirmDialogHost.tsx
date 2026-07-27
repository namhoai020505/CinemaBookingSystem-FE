import { useCallback, useEffect, useRef, useState } from "react";
import ConfirmDialog from "./ConfirmDialog";
import {
  subscribeConfirmPopup,
  type ConfirmPopupRequest,
} from "../services/confirmDialogService";

export default function ConfirmDialogHost() {
  const queueRef = useRef<ConfirmPopupRequest[]>([]);
  const [activeRequest, setActiveRequest] =
    useState<ConfirmPopupRequest | null>(null);

  const showRequest = useCallback((request: ConfirmPopupRequest) => {
    setActiveRequest((current) => {
      if (current) {
        queueRef.current.push(request);
        return current;
      }

      return request;
    });
  }, []);

  useEffect(() => subscribeConfirmPopup(showRequest), [showRequest]);

  const resolveActiveRequest = (confirmed: boolean) => {
    if (!activeRequest) {
      return;
    }

    activeRequest.resolve(confirmed);
    setActiveRequest(queueRef.current.shift() ?? null);
  };

  return (
    <ConfirmDialog
      open={Boolean(activeRequest)}
      title={activeRequest?.title || "Xác nhận thao tác"}
      message={activeRequest?.message || ""}
      confirmLabel={activeRequest?.confirmLabel}
      cancelLabel={activeRequest?.cancelLabel}
      onConfirm={() => resolveActiveRequest(true)}
      onClose={() => resolveActiveRequest(false)}
    />
  );
}
