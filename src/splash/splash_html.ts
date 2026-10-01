import cimesLogo from "./assets/cimes.webp?inline";
import panorama from "./assets/panorama.webp?inline";
import canopeLogo from "./assets/canope.webp?inline";

/**
 * Self-contained splash page: images are inlined so it renders instantly and
 * does not depend on any file outside the packaged bundle.
 */
export function buildSplashHtml(): string {
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'">
<title>Cimes</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: 100%; height: 100%; overflow: hidden; }
  body {
    position: relative;
    background: linear-gradient(135deg, #ffffff 0%, #ffffff 45%, #eaf4f8 100%);
    font-family: "Segoe UI", "Marianne", system-ui, -apple-system, sans-serif;
    color: #0b2a43;
    -webkit-user-select: none;
    user-select: none;
    -webkit-app-region: drag;
  }
  .canope { position: absolute; top: 28px; left: 36px; width: 330px; }
  .panorama { position: absolute; right: -30px; top: 40px; width: 560px; }
  .main {
    position: absolute; left: 36px; top: 118px; width: 400px;
    display: flex; flex-direction: column; align-items: center; text-align: center;
  }
  .cimes { width: 300px; }
  .tagline { margin-top: 8px; font-size: 18px; line-height: 1.35; color: #3f5b6e; }
  .status { position: absolute; left: 36px; bottom: 34px; width: 400px; }
  .status p { font-size: 13px; color: #5a7586; margin-bottom: 8px; text-align: center; }
  .bar { height: 5px; border-radius: 3px; background: #dbe8ee; overflow: hidden; }
  .bar i {
    display: block; height: 100%; width: 38%; border-radius: 3px; background: #1f9e8f;
    animation: slide 1.4s ease-in-out infinite;
  }
  @keyframes slide { 0% { transform: translateX(-110%); } 100% { transform: translateX(300%); } }
</style>
</head>
<body>
  <img class="canope" src="${canopeLogo}" alt="Réseau Canopé">
  <img class="panorama" src="${panorama}" alt="">
  <div class="main">
    <img class="cimes" src="${cimesLogo}" alt="Cimes, Déploiement Albert">
    <p class="tagline">L’assistant IA pour les équipes éducatives en Guyane</p>
  </div>
  <div class="status">
    <p>Démarrage en cours…</p>
    <div class="bar"><i></i></div>
  </div>
</body>
</html>`;
}
