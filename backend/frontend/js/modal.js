const FOCUSABLE_SELECTOR = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export const getFocusableElements = (container) => Array.from(
    container.querySelectorAll(FOCUSABLE_SELECTOR)
).filter((element) => !element.hidden && element.offsetParent !== null);

export const handleFocusTrap = (event, container) => {
    if (event.key !== 'Tab') {
        return;
    }

    const focusable = getFocusableElements(container);
    if (focusable.length === 0) {
        event.preventDefault();
        return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
    }
};
