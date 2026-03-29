import React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

const Modal = ({ isOpen, onClose, title, children, footer }) => {
  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white border border-slate-300 rounded-2xl w-full max-w-lg flex flex-col max-h-[90vh] shadow-2xl animate-in zoom-in-95 duration-200 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-white rounded-t-2xl">
          <h3 className="font-sans font-bold text-lg text-slate-900">
            {title}
          </h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500 hover:text-slate-900"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto custom-scrollbar">{children}</div>

        {footer && (
          <div className="p-5 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
};

export default Modal;
