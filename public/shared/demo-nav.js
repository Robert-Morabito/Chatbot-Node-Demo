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

    // Maps source model API IDs to readable display names
    var MODEL_NAMES = {
        'gpt-3.5-turbo-0125': 'GPT-3.5',
        'gpt-4-1106-preview':  'GPT-4',
        'gpt-5-2025-08-07':    'GPT-5',
    };

    // ── Build UI ──────────────────────────────────────────────────────────────

    function build() {
        var cur    = window.location.pathname;
        var TAB_W  = 22;
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
            'transition:transform 0.2s cubic-bezier(0.4,0,0.2,1)',
            'font-family:ui-monospace,SFMono-Regular,Menlo,monospace',
        ].join(';');

        // ── Handle tab (always visible) ───────────────────────────────────────
        var handle = document.createElement('div');
        handle.style.cssText = [
            'width:' + TAB_W + 'px',
            'background:#161b22',
            'border:1px solid #30363d',
            'border-right:none',
            'border-radius:8px 0 0 8px',
            'display:flex',
            'flex-direction:column',
            'align-items:center',
            'justify-content:center',
            'gap:6px',
            'cursor:pointer',
            'flex-shrink:0',
            'padding:10px 0',
        ].join(';');

        // "demo" written vertically
        var tabText = document.createElement('span');
        tabText.textContent = 'demo';
        tabText.style.cssText = [
            'color:#8b949e',
            'font-size:10px',
            'letter-spacing:0.12em',
            'writing-mode:vertical-lr',
            'text-transform:uppercase',
            'user-select:none',
        ].join(';');

        // Arrow indicator
        var arrow = document.createElement('span');
        arrow.textContent = '◁';
        arrow.style.cssText = [
            'color:#8b949e',
            'font-size:9px',
            'line-height:1',
            'user-select:none',
        ].join(';');

        handle.appendChild(tabText);
        handle.appendChild(arrow);

        // ── Content panel ─────────────────────────────────────────────────────
        var panel = document.createElement('div');
        panel.style.cssText = [
            'background:#0d1117',
            'border:1px solid #30363d',
            'border-right:none',
            'border-left:none',
            'padding:12px 11px',
            'display:flex',
            'flex-direction:column',
            'gap:4px',
            'min-width:150px',
        ].join(';');

        // Section label
        var lbl = document.createElement('div');
        lbl.textContent = 'demo';
        lbl.style.cssText = [
            'color:#8b949e',
            'font-size:10px',
            'letter-spacing:0.12em',
            'text-transform:uppercase',
            'padding-bottom:8px',
            'margin-bottom:2px',
            'border-bottom:1px solid #21262d',
        ].join(';');
        panel.appendChild(lbl);

        // Page buttons
        PAGES.forEach(function (page) {
            var active = cur === page.base || cur.startsWith(page.base + '/');

            var btn = document.createElement('button');
            btn.textContent = page.label;
            btn.style.cssText = [
                'display:block',
                'width:auto',
                'background:' + (active ? '#1f6feb' : 'transparent'),
                'color:'      + (active ? '#e6edf3'  : '#8b949e'),
                'border:1px solid ' + (active ? '#388bfd' : 'transparent'),
                'border-radius:5px',
                'padding:5px 10px',
                'font-size:12px',
                'font-family:inherit',
                'text-align:left',
                'white-space:nowrap',
                'cursor:' + (active ? 'default' : 'pointer'),
            ].join(';');

            if (!active) {
                btn.onmouseenter = function () {
                    btn.style.background  = '#21262d';
                    btn.style.color       = '#e6edf3';
                    btn.style.borderColor = '#30363d';
                };
                btn.onmouseleave = function () {
                    btn.style.background  = 'transparent';
                    btn.style.color       = '#8b949e';
                    btn.style.borderColor = 'transparent';
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
            'border-top:1px solid #21262d',
            'margin-top:6px',
            'padding-top:8px',
        ].join(';');

        var toldRow = document.createElement('div');
        toldRow.id  = 'demo-nav-told';
        toldRow.style.cssText = 'color:#8b949e;font-size:11px;padding:2px 0;white-space:nowrap;';
        toldRow.textContent   = 'Told: —';

        var trueRow = document.createElement('div');
        trueRow.id  = 'demo-nav-true';
        trueRow.style.cssText = 'color:#8b949e;font-size:11px;padding:2px 0;white-space:nowrap;';
        trueRow.textContent   = 'True: —';

        divider.appendChild(toldRow);
        divider.appendChild(trueRow);
        panel.appendChild(divider);

        // ── Open / close ──────────────────────────────────────────────────────
        function open() {
            if (isOpen) return;
            isOpen = true;
            nav.style.transform = 'translateY(-50%) translateX(0)';
            arrow.textContent   = '▷';
        }
        function close() {
            if (!isOpen) return;
            isOpen = false;
            nav.style.transform = 'translateY(-50%) translateX(calc(100% - ' + TAB_W + 'px))';
            arrow.textContent   = '◁';
        }

        document.addEventListener('mousemove', function (e) {
            if (!isOpen && window.innerWidth - e.clientX < 60) open();
        });
        nav.addEventListener('mouseleave', close);
        handle.addEventListener('click', function () { isOpen ? close() : open(); });

        nav.appendChild(handle);
        nav.appendChild(panel);
        document.body.appendChild(nav);

        // ── Poll for allocation config and update model rows ──────────────────
        function getConfig() {
            if (window.studyCore   && window.studyCore.config)                return window.studyCore.config;
            if (window.welcomePage && window.welcomePage.core && window.welcomePage.core.config)
                return window.welcomePage.core.config;
            return null;
        }

        function updateModelInfo(config) {
            var told = config.givenModel || '—';
            var trueId = config.trueModel || '';
            var trueDisplay = MODEL_NAMES[trueId] || trueId || '—';

            toldRow.innerHTML = 'Told: <strong style="color:#e6edf3;">' + told + '</strong>';
            trueRow.innerHTML = 'True: <strong style="color:#e6edf3;">' + trueDisplay + '</strong>';
        }

        var pollTimer = setInterval(function () {
            var config = getConfig();
            if (config && config.givenModel) {
                updateModelInfo(config);
                clearInterval(pollTimer);
            }
        }, 200);

        // Stop polling after 15 s regardless
        setTimeout(function () { clearInterval(pollTimer); }, 15000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', build);
    } else {
        build();
    }

})();
