(function () {

    // ── Participant ID resolution (runs immediately) ──────────────────────────

    var KEY = 'demo_participant_id';

    // 1. Path-based: /page-name/XXXX
    var pathParts = window.location.pathname.split('/').filter(Boolean);
    var pathPid   = pathParts[pathParts.length - 1];
    if (pathPid && /^[a-zA-Z0-9]{24}$/.test(pathPid)) {
        sessionStorage.setItem(KEY, pathPid);
    }

    // 2. Query param fallback: ?pid=XXXX
    var qPid = new URLSearchParams(window.location.search).get('pid');
    if (qPid && /^[a-zA-Z0-9]{24}$/.test(qPid)) {
        sessionStorage.setItem(KEY, qPid);
    }

    // 3. Generate a fresh ID if nothing stored yet
    var demoId = sessionStorage.getItem(KEY);
    if (!demoId) {
        var chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        demoId = Array.from({ length: 24 }, function () {
            return chars[Math.floor(Math.random() * chars.length)];
        }).join('');
        sessionStorage.setItem(KEY, demoId);
    }

    window.__demoParticipantId = demoId;

    // ── Nav UI ────────────────────────────────────────────────────────────────

    var PAGES = [
        { label: 'Welcome',   base: '/welcome'      },
        { label: 'Image Gen', base: '/image-gen'    },
        { label: 'Outreach',  base: '/outreach-msg' },
        { label: 'Acronym',   base: '/acro-build'   },
    ];

    function build() {
        var cur = window.location.pathname;

        var bar = document.createElement('div');
        bar.id  = 'demo-nav';
        bar.style.cssText = [
            'position:fixed',
            'top:10px',
            'right:12px',
            'z-index:99999',
            'display:flex',
            'align-items:center',
            'gap:1px',
            'background:#0d1117',
            'border:1px solid #30363d',
            'border-radius:6px',
            'padding:4px 6px',
            'font-family:ui-monospace,SFMono-Regular,Menlo,monospace',
            'box-shadow:0 4px 16px rgba(0,0,0,0.5)',
        ].join(';');

        // Label
        var lbl = document.createElement('span');
        lbl.textContent = 'demo';
        lbl.style.cssText = [
            'color:#8b949e',
            'font-size:10px',
            'padding-right:8px',
            'margin-right:4px',
            'border-right:1px solid #30363d',
            'letter-spacing:0.06em',
        ].join(';');
        bar.appendChild(lbl);

        PAGES.forEach(function (page) {
            var active = cur === page.base || cur.startsWith(page.base + '/');

            var btn = document.createElement('button');
            btn.textContent = page.label;
            btn.style.cssText = [
                'background:' + (active ? '#1f6feb' : 'none'),
                'color:'      + (active ? '#e6edf3'  : '#8b949e'),
                'border:none',
                'border-radius:4px',
                'padding:3px 9px',
                'font-size:11px',
                'font-family:inherit',
                'cursor:'     + (active ? 'default' : 'pointer'),
                'white-space:nowrap',
                'letter-spacing:0.02em',
            ].join(';');

            if (!active) {
                btn.onmouseenter = function () {
                    btn.style.color      = '#e6edf3';
                    btn.style.background = '#21262d';
                };
                btn.onmouseleave = function () {
                    btn.style.color      = '#8b949e';
                    btn.style.background = 'none';
                };
                btn.onclick = function () {
                    window.location.href = page.base + '/' + demoId;
                };
            }

            bar.appendChild(btn);
        });

        document.body.appendChild(bar);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', build);
    } else {
        build();
    }

})();
