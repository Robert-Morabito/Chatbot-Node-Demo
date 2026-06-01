(function () {
    // ── Session ID management (runs immediately, no DOM needed) ──────────────

    var DEMO_ID_KEY = 'demo_participant_id';

    // If the URL already carries ?pid=..., honour it and persist it
    var urlPid = new URLSearchParams(window.location.search).get('pid');
    if (urlPid && /^[a-zA-Z0-9]{24}$/.test(urlPid)) {
        sessionStorage.setItem(DEMO_ID_KEY, urlPid);
    }

    // Get or create a 24-char demo participant ID for this browser session
    var demoId = sessionStorage.getItem(DEMO_ID_KEY);
    if (!demoId) {
        var chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        demoId = Array.from({ length: 24 }, function () {
            return chars[Math.floor(Math.random() * chars.length)];
        }).join('');
        sessionStorage.setItem(DEMO_ID_KEY, demoId);
    }

    // Expose for welcome.js to read without re-querying sessionStorage
    window.__demoParticipantId = demoId;

    // ── UI (waits for DOM) ────────────────────────────────────────────────────

    var PAGES = [
        { label: 'Welcome',    path: '/welcome',      icon: '👋' },
        { label: 'Image Gen',  path: '/image-gen',    icon: '🎨' },
        { label: 'Outreach',   path: '/outreach-msg', icon: '📱' },
        { label: 'Acronym',    path: '/acro-build',   icon: '🔤' },
    ];

    function buildNav() {
        var currentPath = window.location.pathname;
        var expanded = true;

        // ── Wrapper ──
        var wrap = document.createElement('div');
        wrap.id = 'demo-nav-wrap';
        wrap.style.cssText = [
            'position:fixed',
            'top:14px',
            'right:14px',
            'z-index:99999',
            'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
            'font-size:12px',
            'line-height:1.4',
            'user-select:none',
        ].join(';');

        // ── Header / toggle button ──
        var header = document.createElement('button');
        header.style.cssText = [
            'display:flex',
            'align-items:center',
            'gap:6px',
            'width:100%',
            'background:rgba(15,23,42,0.96)',
            'color:#60a5fa',
            'border:1px solid rgba(59,130,246,0.55)',
            'border-radius:7px 7px 0 0',
            'padding:5px 10px',
            'font-size:11px',
            'font-weight:700',
            'letter-spacing:0.07em',
            'text-transform:uppercase',
            'cursor:pointer',
            'font-family:inherit',
            'white-space:nowrap',
        ].join(';');

        var arrow = document.createElement('span');
        arrow.textContent = '▲';
        arrow.style.fontSize = '9px';

        header.innerHTML = '⚡ Demo Mode &nbsp;';
        header.appendChild(arrow);

        // ── Panel ──
        var panel = document.createElement('div');
        panel.style.cssText = [
            'background:rgba(15,23,42,0.97)',
            'border:1px solid rgba(59,130,246,0.55)',
            'border-top:none',
            'border-radius:0 0 8px 8px',
            'padding:8px',
            'min-width:190px',
        ].join(';');

        PAGES.forEach(function (page) {
            var isActive = currentPath === page.path ||
                           currentPath.startsWith(page.path + '/');

            var btn = document.createElement('button');
            btn.style.cssText = [
                'display:block',
                'width:100%',
                'background:' + (isActive ? 'rgba(59,130,246,0.18)' : 'transparent'),
                'color:' + (isActive ? '#93c5fd' : '#9ca3af'),
                'border:1px solid ' + (isActive ? 'rgba(59,130,246,0.45)' : 'rgba(255,255,255,0.05)'),
                'border-radius:5px',
                'padding:5px 9px',
                'margin-bottom:3px',
                'font-size:12px',
                'text-align:left',
                'cursor:pointer',
                'font-family:inherit',
                'transition:background 0.1s,color 0.1s',
            ].join(';');

            btn.textContent = page.icon + ' ' + page.label + (isActive ? '  ●' : '');

            if (!isActive) {
                btn.onmouseenter = function () {
                    btn.style.background = 'rgba(255,255,255,0.06)';
                    btn.style.color = '#e5e7eb';
                };
                btn.onmouseleave = function () {
                    btn.style.background = 'transparent';
                    btn.style.color = '#9ca3af';
                };
            }

            btn.onclick = function () {
                window.location.href = page.path + '?pid=' + demoId;
            };

            panel.appendChild(btn);
        });

        // ── Explanatory note ──
        var note = document.createElement('p');
        note.style.cssText = [
            'color:#4b5563',
            'font-size:10px',
            'font-style:italic',
            'margin:7px 0 0 0',
            'line-height:1.5',
        ].join(';');
        note.textContent = 'In the study, participants navigated to each page via separate links at different stages.';
        panel.appendChild(note);

        // ── Toggle behaviour ──
        function setExpanded(open) {
            expanded = open;
            panel.style.display = open ? 'block' : 'none';
            header.style.borderRadius = open ? '7px 7px 0 0' : '7px';
            arrow.textContent = open ? '▲' : '▼';
        }

        header.onclick = function () { setExpanded(!expanded); };
        setExpanded(true);

        wrap.appendChild(header);
        wrap.appendChild(panel);
        document.body.appendChild(wrap);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', buildNav);
    } else {
        buildNav();
    }
})();
