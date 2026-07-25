import { useState, useCallback } from "react";
import ConfirmDialog from "../components/ConfirmDialog";

type ConfirmOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel?: () => void;
};

export function useConfirm() {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const confirm = useCallback((opts: ConfirmOptions) => {
    setOptions(opts);
    setIsOpen(true);
  }, []);

  const handleConfirm = useCallback(async () => {
    if (options?.onConfirm) {
      // If the onConfirm function returns a promise, we can show a loading state
      const result = options.onConfirm();
      if (result instanceof Promise) {
        setIsLoading(true);
        try {
          await result;
        } finally {
          setIsLoading(false);
          setIsOpen(false);
        }
      } else {
        setIsOpen(false);
      }
    } else {
      setIsOpen(false);
    }
  }, [options]);

  const handleCancel = useCallback(() => {
    if (options?.onCancel) {
      options.onCancel();
    }
    setIsOpen(false);
  }, [options]);

  const ConfirmComponent = useCallback(() => {
    if (!options) return null;
    return (
      <ConfirmDialog
        open={isOpen}
        title={options.title || "Xác nhận"}
        message={options.message}
        confirmLabel={options.confirmLabel}
        cancelLabel={options.cancelLabel}
        loading={isLoading}
        onConfirm={handleConfirm}
        onClose={handleCancel}
      />
    );
  }, [isOpen, options, isLoading, handleConfirm, handleCancel]);

  return { confirm, ConfirmComponent };
}
