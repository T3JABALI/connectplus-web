import { useEffect, useRef } from 'react';

// Wraps the native <dialog> element. Mount it to open, unmount it to close.
export default function Modal({ onClose, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby="dlgTitle"
      onCancel={(e) => { e.preventDefault(); onClose(); }}
    >
      <div className="dlg">{children}</div>
    </dialog>
  );
}
