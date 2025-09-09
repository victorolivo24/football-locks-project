export default function Head() {
  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: `
            (function(){
              // Allow clicking a selected radio to unselect it
              try {
                var last = null;
                document.addEventListener('pointerdown', function(e){
                  var t = e.target;
                  if (t && t.tagName === 'INPUT' && t.type === 'radio' && !t.disabled && !t.readOnly) {
                    last = { el: t, wasChecked: t.checked };
                  } else {
                    last = null;
                  }
                }, true);
                document.addEventListener('click', function(e){
                  var t = e.target;
                  if (last && last.el === t && last.wasChecked) {
                    e.preventDefault();
                    t.checked = false;
                    t.dispatchEvent(new Event('change', { bubbles: true }));
                  }
                  last = null;
                }, true);
              } catch (_) {}
            })();
          `,
        }}
      />
    </>
  );
}

