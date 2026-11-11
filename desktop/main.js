const { app, BrowserWindow, Menu, session } = require('electron');
const path = require('path');

const AD_HOSTS = [
  'googlesyndication.com', 'doubleclick.net', 'googleadservices.com',
  'googletagservices.com', 'adservice.google.com', 'adtrafficquality.google', '2mdn.net'
];
const isAd = (u) => {
  try {
    const h = new URL(u).hostname;
    return AD_HOSTS.some((d) => h === d || h.endsWith('.' + d));
  } catch (e) { return false; }
};

const HIDE_ADS_JS = `
(function () {
  if (window.__noAds) return;
  window.__noAds = true;
  var sel = 'ins.adsbygoogle,.adsbygoogle,iframe[id^="google_ads"],div[id^="google_ads"],' +
            '[id^="aswift"],iframe[src*="googlesyndication"],iframe[src*="doubleclick"],' +
            '[id^="div-gpt-ad"],.google-auto-placed,[data-ad-status],[data-anchor-status],[data-vignette-loaded]';
  var st = document.createElement('style');
  st.textContent = sel + '{display:none!important;visibility:hidden!important}';
  (document.head || document.documentElement).appendChild(st);
  function sweep() {
    var l = document.querySelectorAll(sel);
    for (var i = 0; i < l.length; i++) l[i].remove();
  }
  sweep();
  new MutationObserver(sweep).observe(document.documentElement, { childList: true, subtree: true });
})();`;

// Halaman perantara (iklan + link "View Map"): sembunyikan, lalu langsung buka petanya.
const SKIP_INTRO_JS = `
(function () {
  var links = document.querySelectorAll('a');
  for (var i = 0; i < links.length; i++) {
    if (/view\\s*map/i.test(links[i].textContent || '')) {
      document.documentElement.style.visibility = 'hidden';
      setTimeout(function () { document.documentElement.style.visibility = ''; }, 3000);
      var h = links[i].href || '';
      if (h.indexOf('http') === 0 && h.split('#')[0] !== location.href.split('#')[0]) location.href = h;
      else links[i].click();
      return 'clicked';
    }
  }
  return 'none';
})();`;

function skipIntro(wc, n) {
  if (n > 40 || wc.isDestroyed()) return;
  wc.executeJavaScript(SKIP_INTRO_JS)
    .then((r) => { if (r !== 'clicked') setTimeout(() => skipIntro(wc, n + 1), 250); })
    .catch(() => {});
}

function createWindow() {
  Menu.setApplicationMenu(null);
  const win = new BrowserWindow({
    width: 1280, height: 800,
    backgroundColor: '#1b1240',
    title: 'Keliling Dunia',
    icon: path.join(__dirname, 'icon.png'),
    autoHideMenuBar: true
  });
  win.maximize();

  session.defaultSession.webRequest.onBeforeRequest((details, cb) => cb({ cancel: isAd(details.url) }));

  const wc = win.webContents;
  wc.on('dom-ready', () => {
    if (!/mapchannels\.com/.test(wc.getURL())) return;
    wc.executeJavaScript(HIDE_ADS_JS).catch(() => {});
    skipIntro(wc, 0);
  });
  wc.setWindowOpenHandler(({ url }) => { wc.loadURL(url); return { action: 'deny' }; });
  wc.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') win.setFullScreen(!win.isFullScreen());
  });

  win.loadFile(path.join(__dirname, 'landing.html'));
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
