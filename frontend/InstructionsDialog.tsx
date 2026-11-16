import { useEffect, useRef } from 'react';

interface Props {
  instructions: { instructions: string; policy_wording: string };
  onClose: () => void;
}
export function InstructionsDialog({ instructions, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={onClose}
      aria-labelledby="instructions-title"
      className="instructions-modal panel"
    >
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Read only</p>
          <h2 id="instructions-title">Agent instructions</h2>
        </div>
        <button onClick={onClose}>Close instructions</button>
      </div>
      <pre>{instructions.instructions}</pre>
      <h3>Policy wording</h3>
      <pre>{instructions.policy_wording}</pre>
    </dialog>
  );
}
