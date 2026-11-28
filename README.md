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

## Pilot Chicken

Le jeu démo est accessible via le menu de SkyJet ou à `/pilot-chicken`. Il tourne entièrement dans le navigateur : aucun appel API, aucune variable d'environnement et aucun argent réel. Le solde de 30 000 F et l'historique sont propres à cette page et réinitialisés à son rechargement. Une Free Bet fictive de 500 F est disponible par session de page. Chaque traversée se déclenche avec « Traverser » ; le joueur peut encaisser à tout moment. Les tirages sont indépendants du solde et des résultats précédents. Le risque commence à 12 %, 20 %, 28 % ou 36 % selon la difficulté, puis augmente de 0,5 point par traversée, plafonné à 50 %. Les multiplicateurs dépendent de la probabilité cumulée de survie et incluent une marge fixe de 4 % ; ils restent purement fictifs et ne sont pas adaptés à des mises réelles.

Les illustrations sont dans `public/assets/pilot-chicken/` : `chicken.webp` et `obstacle.webp` sont des sprites transparents, `runway.jpg` et `start-zone.webp` sont les décors ; les sons WAV sont dans `sounds/`, et `sparks.json` est l'animation Lottie des gains. Remplacez un fichier par une illustration ou un son de même nom et format, puis rechargez. Les sprites fonctionnent mieux avec un fond transparent et une marge autour du sujet. Si les proportions diffèrent, ajustez leurs dimensions dans `components/pilot-chicken/GameScene.tsx`. Vérifiez les licences des nouveaux fichiers avant publication. Les effets sonores synthétiques sont propres à cette démo, sauf `cash.wav` : son crédit est dans `public/sounds/CREDITS.md`.

### Prototype de politique de risque (non activé)

`lib/treasury/risk.ts` contient uniquement un calcul de limites pour une future caisse fictive commune : réserve de 30 % du capital, risque maximal par partie de 1 %, par joueur de 3 %, et plafond prudent horaire de 10 % des fonds propres incluant les engagements ouverts et les pertes brutes réglées. Les montants sont exprimés en centièmes de F ; la réserve est arrondie vers le haut. Les limites sont calculées sur le capital courant et les engagements doivent être comptabilisés simultanément. Une baisse de risque déjà réservé ne doit pas être refusée. Les pertes et les engagements doivent être correctement suivis sur une fenêtre glissante d'une heure.

**Ce prototype n'est relié à aucun jeu et ne protège pas la caisse actuelle.** Avant toute activation, il faut implémenter un serveur faisant autorité pour les deux jeux, une base transactionnelle avec écritures de solde et réservations sérialisées, les règlements idempotents, la reprise des parties, l'identité des joueurs et les tests de concurrence. SkyJet expose actuellement les résultats futurs et calcule ses mises dans le navigateur. La politique de risque seule ne peut pas sécuriser ce fonctionnement. Ne jamais utiliser ce prototype pour de l'argent réel.

Tester le calcul : `node --experimental-strip-types --test tests/treasury-risk.test.mjs` (Node 22 ou supérieur).

La migration `db/migrations/001_fictitious_treasury.sql` et les primitives internes `lib/treasury/transactions.ts` préparent un registre commun et une sérialisation PostgreSQL. **Elles ne sont pas installées automatiquement, ne sont pas branchées aux jeux et ne constituent pas encore une caisse opérationnelle.** Les appelants futurs devront exécuter le contrôle de risque, la logique de jeu et toutes les écritures du portefeuille dans la même transaction, et vérifier le résultat `applied` avant d'appliquer des effets associés. Aucun point d'accès public ne doit accepter des montants ou résultats calculés par le navigateur. La migration doit être testée et déployée explicitement sur une base dédiée ; les tests de concurrence et de reprise sur une vraie base PostgreSQL restent à faire.

La migration `002_fictitious_wallet.sql` et `lib/treasury/wallet.ts` préparent des portefeuilles fictifs séparés par jeu et leurs écritures atomiques avec les réservations. Les fonctions sont internes et doivent être appelées exclusivement dans `withTreasuryTransaction`, par un moteur serveur authentifiant et validant les actions. Elles ne sont pas reliées à l'interface ni activées ; la création répétée de comptes fictifs doit notamment être encadrée avant activation. Un test séquentiel de mise, paiement, répétition et rollback a été effectué sur PGlite ; il ne remplace pas des tests multi-connexions PostgreSQL réels.
