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

              // Add a global "Undo All Picks" button on week pages that clears all radio selections
              function clearAllRadios(){
                var inputs = document.querySelectorAll('input[type="radio"]');
                inputs.forEach(function(inp){
                  if (inp.checked && !inp.disabled && !inp.readOnly) {
                    inp.checked = false;
                    inp.dispatchEvent(new Event('change', { bubbles: true }));
                  }
                });
              }
              function ensureClearButton(){
                var id = 'clear-picks-btn';
                var btn = document.getElementById(id) as HTMLButtonElement | null;
                var onWeek = location && location.pathname && /\/week\//.test(location.pathname);
                if (onWeek) {
                  if (!btn) {
                    btn = document.createElement('button');
                    btn.id = id;
                    btn.type = 'button';
                    btn.textContent = 'Undo All Picks';
                    btn.setAttribute('aria-label', 'Undo all picks');
                    btn.style.position = 'fixed';
                    btn.style.right = '12px';
                    btn.style.bottom = '12px';
                    btn.style.zIndex = '2147483647';
                    btn.style.padding = '10px 12px';
                    btn.style.borderRadius = '8px';
                    btn.style.border = '1px solid rgba(0,0,0,0.1)';
                    btn.style.background = '#1f2937';
                    btn.style.color = 'white';
                    btn.style.fontSize = '14px';
                    btn.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
                    btn.addEventListener('click', function(){
                      clearAllRadios();
                    });
                    document.body.appendChild(btn);
                  } else {
                    btn.style.display = 'block';
                  }
                } else if (btn) {
                  btn.style.display = 'none';
                }
              }
              if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', ensureClearButton);
              } else {
                ensureClearButton();
              }
              // Best-effort keep in sync with client routing
              setInterval(ensureClearButton, 1000);
            })();
          `,
        }}
      />
    </>
  );
}
