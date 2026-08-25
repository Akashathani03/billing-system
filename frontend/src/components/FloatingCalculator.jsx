import { useEffect, useRef, useState } from 'react';
import { BottomSheet } from './BottomSheet';

const BUTTON_SIZE = 56;
const DRAG_THRESHOLD = 6;

// Tall enough to clear every fixed bottom element in the app: the bottom
// nav + raised New Bill button, the Customers/Products "Add" FAB
// (bottom-28, ~168px tall), and New Bill's own fixed Save Draft/Generate
// Invoice bar (bottom-24 + its own padding, ~164px tall). Reusing one
// generous constant means the calculator button can never be DRAGGED on
// top of any of them, not just avoid them at its default resting spot.
const BOTTOM_RESERVED_HEIGHT = 180;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getMaxY() {
  return window.innerHeight - BUTTON_SIZE - BOTTOM_RESERVED_HEIGHT;
}

function getMaxX() {
  return window.innerWidth - BUTTON_SIZE;
}

// Default resting spot: bottom-LEFT — the Customers/Products "Add" FAB
// already lives bottom-right, so defaulting to the opposite corner avoids
// stacking two round buttons together there.
function getDefaultPosition() {
  return {
    x: 16,
    y: getMaxY() - 16,
  };
}

function CalculatorIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6"
    >
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <line x1="8" y1="6.5" x2="16" y2="6.5" />
      <line x1="8" y1="11" x2="8" y2="11" />
      <line x1="12" y1="11" x2="12" y2="11" />
      <line x1="16" y1="11" x2="16" y2="11" />
      <line x1="8" y1="15" x2="8" y2="15" />
      <line x1="12" y1="15" x2="12" y2="15" />
      <line x1="16" y1="15" x2="16" y2="15" />
      <line x1="8" y1="19" x2="8" y2="19" />
      <line x1="12" y1="19" x2="12" y2="19" />
      <line x1="16" y1="19" x2="16" y2="19" />
    </svg>
  );
}

function FloatingButton({ position, onDrag, onTap }) {
  const dragRef = useRef(null);

  function handlePointerDown(e) {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      startClientX: e.clientX,
      startClientY: e.clientY,
      startX: position.x,
      startY: position.y,
      moved: false,
    };
  }

  function handlePointerMove(e) {
    const drag = dragRef.current;
    if (!drag) return;

    const dx = e.clientX - drag.startClientX;
    const dy = e.clientY - drag.startClientY;
    if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
      drag.moved = true;
    }

    onDrag({
      x: clamp(drag.startX + dx, 0, getMaxX()),
      y: clamp(drag.startY + dy, 0, getMaxY()),
    });
  }

  function handlePointerUp() {
    if (dragRef.current && !dragRef.current.moved) {
      onTap();
    }
    dragRef.current = null;
  }

  return (
    <button
      type="button"
      aria-label="Open calculator"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => {
        dragRef.current = null;
      }}
      style={{ left: position.x, top: position.y }}
      className="fixed z-[25] flex h-14 w-14 touch-none select-none items-center justify-center rounded-full bg-neutral-900 text-white shadow-lg shadow-neutral-900/30 active:scale-95"
    >
      <CalculatorIcon />
    </button>
  );
}

function calculate(first, second, operator) {
  switch (operator) {
    case '+':
      return first + second;
    case '-':
      return first - second;
    case '*':
      return first * second;
    case '/':
      return second === 0 ? null : first / second;
    default:
      return second;
  }
}

// Floating-point noise guard (e.g. 0.1 + 0.2) — not a money-precision
// concern like the invoice math elsewhere; this is a standalone utility
// calculator with no connection to any billing data.
function roundResult(value) {
  return Math.round(value * 1e10) / 1e10;
}

const OPERATOR_SYMBOLS = { '+': '+', '-': '−', '*': '×', '/': '÷' };

function CalculatorBody() {
  const [display, setDisplay] = useState('0');
  const [firstOperand, setFirstOperand] = useState(null);
  const [operator, setOperator] = useState(null);
  const [waitingForSecondOperand, setWaitingForSecondOperand] = useState(false);

  function inputDigit(digit) {
    if (display === 'Error' || waitingForSecondOperand) {
      setDisplay(digit);
      setWaitingForSecondOperand(false);
      return;
    }
    setDisplay(display === '0' ? digit : display + digit);
  }

  function inputDecimal() {
    if (display === 'Error' || waitingForSecondOperand) {
      setDisplay('0.');
      setWaitingForSecondOperand(false);
      return;
    }
    if (!display.includes('.')) {
      setDisplay(`${display}.`);
    }
  }

  function clearAll() {
    setDisplay('0');
    setFirstOperand(null);
    setOperator(null);
    setWaitingForSecondOperand(false);
  }

  function backspace() {
    if (display === 'Error' || waitingForSecondOperand) return;
    if (display.length <= 1 || (display.length === 2 && display.startsWith('-'))) {
      setDisplay('0');
    } else {
      setDisplay(display.slice(0, -1));
    }
  }

  function handleOperatorPress(nextOperator) {
    if (display === 'Error') return;
    const inputValue = parseFloat(display);

    if (operator && !waitingForSecondOperand) {
      const result = calculate(firstOperand, inputValue, operator);
      if (result === null) {
        setDisplay('Error');
        setFirstOperand(null);
        setOperator(null);
        setWaitingForSecondOperand(false);
        return;
      }
      const rounded = roundResult(result);
      setDisplay(String(rounded));
      setFirstOperand(rounded);
    } else {
      setFirstOperand(inputValue);
    }

    setOperator(nextOperator);
    setWaitingForSecondOperand(true);
  }

  function handleEquals() {
    if (display === 'Error' || operator === null || firstOperand === null) return;
    const inputValue = parseFloat(display);
    const result = calculate(firstOperand, inputValue, operator);

    setDisplay(result === null ? 'Error' : String(roundResult(result)));
    setFirstOperand(null);
    setOperator(null);
    setWaitingForSecondOperand(true);
  }

  const digitButton = 'h-14 rounded-xl bg-neutral-100 text-lg font-semibold text-neutral-900 active:bg-neutral-200';
  const operatorButton = 'h-14 rounded-xl bg-blue-50 text-lg font-semibold text-blue-700 active:bg-blue-100';
  const utilButton = 'h-14 rounded-xl bg-neutral-200 text-lg font-semibold text-neutral-700 active:bg-neutral-300';
  const equalsButton = 'h-14 rounded-xl bg-blue-700 text-lg font-semibold text-white active:bg-blue-800';

  return (
    <div>
      <div className="rounded-xl bg-neutral-900 px-4 py-5 text-right">
        <p className="h-5 text-sm text-neutral-400">
          {operator && firstOperand !== null ? `${firstOperand} ${OPERATOR_SYMBOLS[operator]}` : ' '}
        </p>
        <p className="mt-1 overflow-x-auto whitespace-nowrap text-3xl font-semibold text-white">{display}</p>
      </div>

      <div className="mt-3 grid grid-cols-4 gap-2">
        <button type="button" onClick={clearAll} className={utilButton}>
          C
        </button>
        <button type="button" onClick={backspace} aria-label="Backspace" className={utilButton}>
          ⌫
        </button>
        <span aria-hidden="true" />
        <button type="button" onClick={() => handleOperatorPress('/')} className={operatorButton}>
          ÷
        </button>

        <button type="button" onClick={() => inputDigit('7')} className={digitButton}>
          7
        </button>
        <button type="button" onClick={() => inputDigit('8')} className={digitButton}>
          8
        </button>
        <button type="button" onClick={() => inputDigit('9')} className={digitButton}>
          9
        </button>
        <button type="button" onClick={() => handleOperatorPress('*')} className={operatorButton}>
          ×
        </button>

        <button type="button" onClick={() => inputDigit('4')} className={digitButton}>
          4
        </button>
        <button type="button" onClick={() => inputDigit('5')} className={digitButton}>
          5
        </button>
        <button type="button" onClick={() => inputDigit('6')} className={digitButton}>
          6
        </button>
        <button type="button" onClick={() => handleOperatorPress('-')} className={operatorButton}>
          −
        </button>

        <button type="button" onClick={() => inputDigit('1')} className={digitButton}>
          1
        </button>
        <button type="button" onClick={() => inputDigit('2')} className={digitButton}>
          2
        </button>
        <button type="button" onClick={() => inputDigit('3')} className={digitButton}>
          3
        </button>
        <button type="button" onClick={() => handleOperatorPress('+')} className={operatorButton}>
          +
        </button>

        <button type="button" onClick={() => inputDigit('0')} className={`${digitButton} col-span-2`}>
          0
        </button>
        <button type="button" onClick={inputDecimal} className={digitButton}>
          .
        </button>
        <button type="button" onClick={handleEquals} className={equalsButton}>
          =
        </button>
      </div>
    </div>
  );
}

export function FloatingCalculator() {
  const [position, setPosition] = useState(getDefaultPosition);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function handleResize() {
      setPosition((prev) => ({
        x: clamp(prev.x, 0, getMaxX()),
        y: clamp(prev.y, 0, getMaxY()),
      }));
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <>
      {!open && <FloatingButton position={position} onDrag={setPosition} onTap={() => setOpen(true)} />}
      <BottomSheet open={open} title="Calculator" onClose={() => setOpen(false)}>
        <CalculatorBody />
      </BottomSheet>
    </>
  );
}
