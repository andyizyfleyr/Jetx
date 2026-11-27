# SkyJet · démo

Jeu de crash mobile-first, entièrement simulé dans le navigateur. Aucun argent réel, serveur de jeu, clé ou variable d’environnement n’est utilisé.

## Installation

```bash
npm install
npm run dev
```

Ouvrir http://localhost:3000. Vérifications : `npm run lint` et `npm run build`.

## Arborescence

```text
app/          layout, page et styles globaux
components/   interface, cartes, historique, onglets et scène Canvas
hooks/        boucle de jeu requestAnimationFrame
lib/          sons synthétisés avec Web Audio
store/        état et opérations de jeu Zustand
```

Le solde et les manches sont fictifs et réinitialisés au rechargement. Le « ping » est indiqué LOCAL : sans serveur ni API, aucune mesure de latence réseau réelle n’est possible. Les avatars et joueurs sont simulés.
