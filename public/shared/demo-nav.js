(function () {

    // ── Participant ID (runs immediately) ─────────────────────────────────────

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

    // ── Pages ─────────────────────────────────────────────────────────────────

    var PAGES = [
        { label: 'Welcome',   base: '/welcome'      },
        { label: 'Image Gen', base: '/image-gen'    },
        { label: 'Outreach',  base: '/outreach-msg' },
        { label: 'Acronym',   base: '/acro-build'   },
    ];

    // ── Build UI ──────────────────────────────────────────────────────────────

    function build() {
        var cur      = window.location.pathname;
        var TAB_W    = 14;
        var isOpen   = false;

        // Outer container — sits flush against the right edge
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
            // Only the TAB_W-pixel handle is visible when closed
            'transform:translateY(-50%) translateX(calc(100% - ' + TAB_W + 'px))',
            'transition:transform 0.2s cubic-bezier(0.4,0,0.2,1)',
            'font-family:ui-monospace,SFMono-Regular,Menlo,monospace',
        ].join(';');

        // ── Handle (always visible, left edge of the component) ──────────────
        var handle = document.createElement('div');
        handle.style.cssText = [
            'width:' + TAB_W + 'px',
            'background:#161b22',
            'border:1px solid #30363d',
            'border-right:none',
            'border-radius:6px 0 0 6px',
            'display:flex',
            'align-items:center',
            'justify-content:center',
            'cursor:pointer',
            'flex-shrink:0',
        ].join(';');

        var arrow = document.createElement('span');
        arrow.textContent = '◁';
        arrow.style.cssText = 'color:#8b949e;font-size:8px;line-height:1;';
        handle.appendChild(arrow);

        // ── Content panel ─────────────────────────────────────────────────────
        var panel = document.createElement('div');
        panel.style.cssText = [
            'background:#0d1117',
            'border:1px solid #30363d',
            'border-right:none',
            'border-left:none',
            'padding:10px 9px',
            'display:flex',
            'flex-direction:column',
            'gap:3px',
            'min-width:116px',
        ].join(';');

        // Label
        var lbl = document.createElement('div');
        lbl.textContent = 'demo';
        lbl.style.cssText = [
            'color:#8b949e',
            'font-size:9px',
            'letter-spacing:0.12em',
            'text-transform:uppercase',
            'padding-bottom:7px',
            'margin-bottom:2px',
            'border-bottom:1px solid #21262d',
        ].join(';');
        panel.appendChild(lbl);

        // Nav buttons
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
                'border-radius:4px',
                'padding:4px 8px',
                'font-size:11px',
                'font-family:inherit',
                'text-align:left',
                'white-space:nowrap',
                'cursor:' + (active ? 'default' : 'pointer'),
            ].join(';');

            if (!active) {
                btn.onmouseenter = function () {
                    btn.style.background   = '#21262d';
                    btn.style.color        = '#e6edf3';
                    btn.style.borderColor  = '#30363d';
                };
                btn.onmouseleave = function () {
                    btn.style.background   = 'transparent';
                    btn.style.color        = '#8b949e';
                    btn.style.borderColor  = 'transparent';
                };
                btn.onclick = function () {
                    window.location.href = page.base + '/' + demoId;
                };
            }

            panel.appendChild(btn);
        });

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

        // Expand when mouse is within 50 px of the right edge
        document.addEventListener('mousemove', function (e) {
            if (!isOpen && window.innerWidth - e.clientX < 50) open();
        });

        // Collapse when mouse fully leaves the nav
        nav.addEventListener('mouseleave', close);

        // Toggle on handle click (touch / keyboard access)
        handle.addEventListener('click', function () { isOpen ? close() : open(); });

        nav.appendChild(handle);
        nav.appendChild(panel);
        document.body.appendChild(nav);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', build);
    } else {
        build();
    }

})();
