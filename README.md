# SkyJet · démo

Jeu de crash mobile-first en mode démo. Les manches sont communes grâce à une horloge UTC servie par une route Next.js ; les mises et les soldes restent uniquement dans le navigateur. Aucune clé ni variable d’environnement n’est nécessaire. Aucun argent réel.

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

Le solde et les mises sont fictifs et réinitialisés au rechargement. Les autres joueurs et leur nombre sont simulés, et ne sont pas synchronisés. Le ping est la durée aller-retour mesurée vers la route de synchronisation. Les connexions peuvent introduire un léger décalage ; les mises sont suspendues lorsque la synchronisation est indisponible.

Le calendrier des manches est déterministe, public et périodique pour permettre la synchronisation sans base de données. Les résultats futurs sont donc prévisibles : ce mécanisme est strictement réservé à la démonstration, non sécurisé et inadapté à tout jeu en argent réel.
