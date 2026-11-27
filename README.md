# SkyJet · démo

Jeu de crash mobile-first en mode démo. Les manches sont communes grâce à une horloge UTC servie par une route Next.js ; les mises et les soldes restent uniquement dans le navigateur. Sans base de données, le jeu fonctionne en mode normal et les commandes de pilotage sont désactivées. Aucun argent réel.

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

Le solde, les mises en cours, les montants saisis et les préférences sont fictifs et enregistrés localement dans le navigateur. Ils ne sont pas partagés entre appareils et peuvent disparaître si les données du navigateur sont effacées. Évitez de jouer simultanément dans plusieurs onglets : ils ne sont pas synchronisés entre eux. Les autres joueurs et leur nombre sont simulés, et ne sont pas synchronisés. Le ping est la durée aller-retour mesurée vers la route de synchronisation. Les connexions peuvent introduire un léger décalage ; les mises sont suspendues lorsque la synchronisation est indisponible.

Le calendrier des manches est déterministe, public et périodique. Avec une base Neon, les changements de mode sont partagés et conservés. Les résultats futurs sont donc prévisibles : ce mécanisme est strictement réservé à la démonstration, non sécurisé et inadapté à tout jeu en argent réel.

### Prochaines manches

La page `/previsions`, accessible depuis le menu, affiche les quatre résultats programmés après la manche en cours. Elle lit le même calendrier public que le jeu et se resynchronise régulièrement. Ce ne sont pas des prédictions de jeux externes : les résultats de cette démo sont calculés à l’avance et prévisibles.

### Pilotage public et Neon

Renseigner `DATABASE_URL` dans les variables d’environnement Vercel avec l’URL PostgreSQL Neon (connexion poolée avec TLS), puis redéployer pour que le changement prenne effet. En local, définir cette variable dans `.env.local`, sans la committer. Le compte utilisé doit pouvoir créer une table dans le schéma par défaut et la lire et modifier. La table `skyjet_mode_events` est créée automatiquement à la première requête.

Sans variable, le jeu continue en mode normal et les commandes restent désactivées. Si la base configurée est indisponible, les clients suspendent la synchronisation plutôt que de produire des manches divergentes. Les commandes sont publiques : n’importe quel visiteur peut modifier les manches pour tous. Elles ne conviennent pas à une production sécurisée.

Un changement s’applique à une manche future, indiquée sur la page ; un délai de publication d’au moins huit secondes permet de synchroniser les clients, donc il peut prendre effet après la manche immédiatement suivante. La manche en cours ne change jamais. Les modes modifient les tendances du calendrier : gentil multiplie l’écart à 1x par 2, plus gentil par 4, beaucoup plus gentil par 8, méchant par 0,5, pire par 0,2, plus pire par 0,1 et beaucoup plus pire par 0,05. Il n’y a aucune garantie de résultat. Les prévisions peuvent changer si un visiteur modifie le mode.

### Écran actif

Sur la page de jeu, SkyJet demande au navigateur de maintenir l’écran allumé (Screen Wake Lock API). Le verrou est libéré hors de la page ou lorsque l’onglet est masqué, puis redemandé au retour. Cette fonctionnalité dépend de la compatibilité du navigateur, de HTTPS et des réglages de l’appareil ; le navigateur peut la refuser, notamment en mode économie d’énergie.

Les deux boutons aléatoires programment un seul résultat partagé : de 100 à 1 000x ou de 1,01 à 2x, au centième. La manche ciblée est affichée et le mode prévu reprend ensuite. Un autre visiteur peut modifier une programmation encore à venir. Ces résultats restent publics et ne conviennent pas à de l’argent réel.
