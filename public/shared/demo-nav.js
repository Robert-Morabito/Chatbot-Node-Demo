(function () {

    // ── Participant ID ────────────────────────────────────────────────────────

    var KEY = 'demo_participant_id';

    var pathParts = window.location.pathname.split('/').filter(Boolean);
    var pathPid   = pathParts[pathParts.length - 1];
    if (pathPid && /^[a-zA-Z0-9]{24}$/.test(pathPid)) {
        sessionStorage.setItem(KEY, pathPid);
    }

    var qPid = new URLSearchParams(window.location.search).get('pid');
    if (qPid && /^[a-zA-Z0-9]{24}$/.test(qPid)) {
        sessionStorage.setItem(KEY, qPid);
    }

    var demoId = sessionStorage.getItem(KEY);
    if (!demoId) {
        var chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        demoId = Array.from({ length: 24 }, function () {
            return chars[Math.floor(Math.random() * chars.length)];
        }).join('');
        sessionStorage.setItem(KEY, demoId);
    }

    window.__demoParticipantId = demoId;

    // ── Config ────────────────────────────────────────────────────────────────

    var PAGES = [
        { label: 'Welcome',   base: '/welcome'      },
        { label: 'Image Gen', base: '/image-gen'    },
        { label: 'Outreach',  base: '/outreach-msg' },
        { label: 'Acronym',   base: '/acro-build'   },
    ];

    var MODEL_NAMES = {
        'gpt-3.5-turbo-0125': 'GPT-3.5',
        'gpt-4-turbo':         'GPT-4',
        'gpt-5-2025-08-07':    'GPT-5',
    };

    var FONT = '-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",Roboto,sans-serif';

    // ── Build UI ──────────────────────────────────────────────────────────────

    function build() {
        var cur    = window.location.pathname;
        var TAB_W  = 26;
        var isOpen = false;

        // ── Outer container ───────────────────────────────────────────────────
        var nav = document.createElement('div');
        nav.id  = 'demo-nav';
        nav.style.cssText = [
            'position:fixed',
            'right:0',
            'top:50%',
            'z-index:99999',
            'display:flex',
            'flex-direction:row',
            'align-items:stretch',
            'transform:translateY(-50%) translateX(calc(100% - ' + TAB_W + 'px))',
            'transition:transform 0.28s cubic-bezier(0.32,0.72,0,1)',
            'font-family:' + FONT,
            '-webkit-font-smoothing:antialiased',
        ].join(';');

        // ── Handle tab (always visible) ───────────────────────────────────────
        var handle = document.createElement('div');
        handle.style.cssText = [
            'width:' + TAB_W + 'px',
            'background:rgba(28,28,30,0.78)',
            '-webkit-backdrop-filter:blur(20px) saturate(180%)',
            'backdrop-filter:blur(20px) saturate(180%)',
            'border:0.5px solid rgba(255,255,255,0.12)',
            'border-right:none',
            'border-radius:12px 0 0 12px',
            'display:flex',
            'flex-direction:column',
            'align-items:center',
            'justify-content:center',
            'gap:8px',
            'cursor:pointer',
            'flex-shrink:0',
            'padding:14px 0',
            'box-shadow:-4px 0 24px rgba(0,0,0,0.18)',
        ].join(';');

        var tabText = document.createElement('span');
        tabText.textContent = 'demo';
        tabText.style.cssText = [
            'color:rgba(255,255,255,0.72)',
            'font-size:11px',
            'font-weight:600',
            'letter-spacing:0.16em',
            'writing-mode:vertical-lr',
            'text-transform:uppercase',
            'user-select:none',
        ].join(';');

        var arrow = document.createElement('span');
        arrow.textContent = '‹';
        arrow.style.cssText = [
            'color:rgba(255,255,255,0.42)',
            'font-size:14px',
            'line-height:1',
            'font-weight:400',
            'user-select:none',
            'transition:transform 0.28s cubic-bezier(0.32,0.72,0,1)',
        ].join(';');

        handle.appendChild(tabText);
        handle.appendChild(arrow);

        // ── Content panel ─────────────────────────────────────────────────────
        var panel = document.createElement('div');
        panel.style.cssText = [
            'background:rgba(28,28,30,0.78)',
            '-webkit-backdrop-filter:blur(20px) saturate(180%)',
            'backdrop-filter:blur(20px) saturate(180%)',
            'border:0.5px solid rgba(255,255,255,0.12)',
            'border-right:none',
            'border-left:none',
            'padding:16px 14px',
            'display:flex',
            'flex-direction:column',
            'gap:5px',
            'min-width:172px',
            'box-shadow:-4px 0 24px rgba(0,0,0,0.18)',
        ].join(';');

        // Section label
        var lbl = document.createElement('div');
        lbl.textContent = 'Demo Mode';
        lbl.style.cssText = [
            'color:rgba(255,255,255,0.5)',
            'font-size:11px',
            'font-weight:600',
            'letter-spacing:0.04em',
            'padding:0 4px 10px 4px',
            'margin-bottom:4px',
            'border-bottom:0.5px solid rgba(255,255,255,0.08)',
        ].join(';');
        panel.appendChild(lbl);

        // Page buttons
        PAGES.forEach(function (page) {
            var active = cur === page.base || cur.startsWith(page.base + '/');

            var btn = document.createElement('button');
            btn.textContent = page.label;
            btn.style.cssText = [
                'display:block',
                'width:100%',
                'background:' + (active ? 'rgba(10,132,255,0.92)' : 'transparent'),
                'color:'      + (active ? '#ffffff'              : 'rgba(255,255,255,0.82)'),
                'border:none',
                'border-radius:8px',
                'padding:8px 12px',
                'font-size:14px',
                'font-weight:' + (active ? '600' : '500'),
                'font-family:inherit',
                'text-align:left',
                'white-space:nowrap',
                'cursor:' + (active ? 'default' : 'pointer'),
                'letter-spacing:-0.01em',
                'transition:background 0.15s ease,color 0.15s ease',
                '-webkit-appearance:none',
            ].join(';');

            if (!active) {
                btn.onmouseenter = function () {
                    btn.style.background = 'rgba(255,255,255,0.08)';
                    btn.style.color      = '#ffffff';
                };
                btn.onmouseleave = function () {
                    btn.style.background = 'transparent';
                    btn.style.color      = 'rgba(255,255,255,0.82)';
                };
                btn.onclick = function () {
                    window.location.href = page.base + '/' + demoId;
                };
            }

            panel.appendChild(btn);
        });

        // ── Model info section ────────────────────────────────────────────────
        var divider = document.createElement('div');
        divider.style.cssText = [
            'border-top:0.5px solid rgba(255,255,255,0.08)',
            'margin-top:10px',
            'padding:10px 4px 0 4px',
            'display:flex',
            'flex-direction:column',
            'gap:6px',
        ].join(';');

        function makeRow(labelText) {
            var row = document.createElement('div');
            row.style.cssText = [
                'display:flex',
                'justify-content:space-between',
                'align-items:baseline',
                'font-size:13px',
                'letter-spacing:-0.01em',
            ].join(';');

            var k = document.createElement('span');
            k.textContent = labelText;
            k.style.cssText = 'color:rgba(255,255,255,0.5);font-weight:500;';

            var v = document.createElement('span');
            v.textContent = '—';
            v.style.cssText = 'color:rgba(255,255,255,0.92);font-weight:600;';

            row.appendChild(k);
            row.appendChild(v);
            return { row: row, value: v };
        }

        var told = makeRow('Told');
        var trueR = makeRow('True');
        divider.appendChild(told.row);
        divider.appendChild(trueR.row);
        panel.appendChild(divider);

        // ── Open / close ──────────────────────────────────────────────────────
        function open() {
            if (isOpen) return;
            isOpen = true;
            nav.style.transform = 'translateY(-50%) translateX(0)';
            arrow.style.transform = 'rotate(180deg)';
        }
        function close() {
            if (!isOpen) return;
            isOpen = false;
            nav.style.transform = 'translateY(-50%) translateX(calc(100% - ' + TAB_W + 'px))';
            arrow.style.transform = 'rotate(0deg)';
        }

        document.addEventListener('mousemove', function (e) {
            if (!isOpen && window.innerWidth - e.clientX < 60) open();
        });
        nav.addEventListener('mouseleave', close);
        handle.addEventListener('click', function () { isOpen ? close() : open(); });

        nav.appendChild(handle);
        nav.appendChild(panel);
        document.body.appendChild(nav);

        // ── Poll for allocation config ────────────────────────────────────────
        function getConfig() {
            if (window.studyCore   && window.studyCore.config)                return window.studyCore.config;
            if (window.welcomePage && window.welcomePage.core && window.welcomePage.core.config)
                return window.welcomePage.core.config;
            return null;
        }

        var pollTimer = setInterval(function () {
            var config = getConfig();
            if (config && config.givenModel) {
                told.value.textContent  = config.givenModel || '—';
                trueR.value.textContent = MODEL_NAMES[config.trueModel] || config.trueModel || '—';
                clearInterval(pollTimer);
            }
        }, 200);

        setTimeout(function () { clearInterval(pollTimer); }, 15000);

        // ── Demo-only: turn the task-completion button into a Back button ────
        // In the original study, participants would close the tab and take a
        // survey before being given the next URL. For the demo we just bounce
        // back to the welcome page so reviewers can keep exploring.
        rewireFinishAsBack();
    }

    function rewireFinishAsBack() {
        // Relabel the button (chat.js doesn't touch the text after init)
        var finishBtn = document.getElementById('finish-btn');
        if (finishBtn) {
            finishBtn.textContent = '← Back';
            finishBtn.title       = 'Return to welcome page (demo)';
        }

        // chat.js binds its click handler with an arrow that calls
        // `this.completeTask()` on the TaskChat instance. We override the
        // method on the instance once it exists — no DOM cloning needed.
        var attempts = 0;
        var timer = setInterval(function () {
            if (window.taskChat) {
                window.taskChat.completeTask = function () {
                    window.location.href = '/welcome/' + demoId;
                };
                clearInterval(timer);
            } else if (++attempts > 50) {
                clearInterval(timer); // give up after ~5s
            }
        }, 100);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', build);
    } else {
        build();
    }

})();
