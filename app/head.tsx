export default function Head() {
  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: `
            (function(){
              // Allow clicking a selected radio to unselect it (handles label clicks)
              var state = { el: null, wasChecked: false };
              function findRadioFromEventTarget(target){
                var el = target;
                while (el && el !== document) {
                  if (el instanceof HTMLInputElement && el.type === 'radio') return el;
                  if (el instanceof HTMLLabelElement) {
                    // Prefer .control when available
                    if (el.control && (el.control as HTMLInputElement).type === 'radio') return el.control as HTMLInputElement;
                    var nested = el.querySelector('input[type="radio"]');
                    if (nested) return nested as HTMLInputElement;
                  }
                  el = (el as HTMLElement).parentElement;
                }
                return null;
              }
              document.addEventListener('pointerdown', function(e){
                var radio = findRadioFromEventTarget(e.target as Element);
                if (radio && !radio.disabled && !radio.readOnly) {
                  state.el = radio;
                  state.wasChecked = radio.checked;
                } else {
                  state.el = null;
                  state.wasChecked = false;
                }
              }, true);
              document.addEventListener('click', function(e){
                var radio = findRadioFromEventTarget(e.target as Element);
                if (state.el && radio === state.el && state.wasChecked) {
                  e.preventDefault();
                  state.el.checked = false;
                  state.el.dispatchEvent(new Event('change', { bubbles: true }));
                }
                state.el = null;
                state.wasChecked = false;
              }, true);
            })();
          `,
        }}
      />
    </>
  );
}
