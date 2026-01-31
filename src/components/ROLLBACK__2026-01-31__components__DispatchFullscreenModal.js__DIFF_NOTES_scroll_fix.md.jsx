
import React from 'react';

/**
 * DispatchFullscreenModal component.
 * This component provides a full-screen modal layout with a fixed header
 * and a scrollable content area, specifically designed to address
 * nested scroll issues for drag-and-drop libraries like @hello-pangea/dnd.
 *
 * It uses flexbox to manage layout:
 * - The root modal container `(fixed inset-0)` is a flex container with `flex-col`.
 * - The header is `flex-shrink-0`, ensuring it takes only its natural height and doesn't scroll.
 * - The content area is `flex-1 overflow-auto`, making it the sole scrollable region
 *   within the modal, taking up all available vertical space.
 *
 * @param {object} props - The component props.
 * @param {React.ReactNode} props.children - The content to be displayed inside the modal's scrollable area.
 * @param {string} [props.title="Dispatch Fullscreen Modal"] - The title to display in the modal header.
 * @param {function} [props.onClose] - Callback function to close the modal. If provided, a close button will be rendered.
 */
const DispatchFullscreenModal = ({ children, title = "Dispatch Fullscreen Modal", onClose }) => {
  return (
    // Modal Root Container: fixed, covers entire screen, uses flexbox for layout
    // Changes: Removed `overflow-auto`, added `flex flex-col`
    <div className="fixed inset-0 bg-slate-900 z-50 flex flex-col">
      {/* Header Section: fixed height, no scroll, stays at top */}
      {/* Changes: Changed `sticky top-0` to `flex-shrink-0` */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0 z-10">
        <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 focus:outline-none"
            aria-label="Close modal"
          >
            {/* Simple X icon for close button */}
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        )}
      </div>

      {/* Content Section: takes remaining space, is the *only* scrollable area */}
      {/* Changes: Added `flex-1 overflow-auto` + id="dispatchScroll" */}
      <div className="flex-1 overflow-auto p-6" id="dispatchScroll">
        {children}
        {/* Placeholder content to demonstrate scrolling */}
        <div style={{ height: '800px', background: '#f9f9f9', marginTop: '20px', padding: '20px', borderRadius: '8px', color: '#333' }}>
          <p className="mb-2 font-medium">This is example content within the scrollable area.</p>
          <p className="mb-2">It's designed to be tall enough to demonstrate scrolling behavior within the `dispatchScroll` container.</p>
          <p className="mb-4">With this scroll fix, this area (`#dispatchScroll`) is the *only* scrollable container for its content, effectively preventing nested scrollbars that can interfere with drag-and-drop functionality.</p>
          {Array.from({ length: 20 }).map((_, i) => (
            <p key={i} className="py-1 text-sm text-gray-700">Line {i + 1} of scrollable content.</p>
          ))}
          <p className="mt-4">End of example scrollable content.</p>
        </div>
      </div>
    </div>
  );
};

export default DispatchFullscreenModal;
