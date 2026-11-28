# SkyJet · démo

Jeu de crash mobile-first avec fonds fictifs. Les manches sont communes et les mises et soldes sont gérés par le serveur PostgreSQL. Sans base de données, les mises sont suspendues. Aucun argent réel.

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

Un solde fictif unique est partagé entre SkyJet et Pilot Chicken côté serveur et associé à un cookie de session ; les préférences et montants saisis restent locaux. Un compte connecté permet de retrouver ce solde sur un autre appareil. Les autres joueurs et leur nombre sont simulés, et ne sont pas synchronisés. Le ping est la durée aller-retour mesurée vers la route de synchronisation. Les mises sont suspendues lorsque le serveur est indisponible.

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

Le jeu est accessible via le menu de SkyJet ou à `/pilot-chicken`. Son solde fictif, ses mises, ses traversées et son historique sont gérés côté serveur ; une session est associée à un cookie. Une Free Bet fictive de 500 F est disponible par session. Chaque traversée se déclenche avec « Traverser » ; le joueur peut encaisser à tout moment. Les tirages sont indépendants du solde et des résultats précédents. Le risque commence à 12 %, 20 %, 28 % ou 36 % selon la difficulté, puis augmente de 0,5 point par traversée, plafonné à 50 %. Les multiplicateurs dépendent de la probabilité cumulée de survie et incluent une marge fixe de 4 %.

Les illustrations sont dans `public/assets/pilot-chicken/` : `chicken.webp` et `obstacle.webp` sont des sprites transparents, `runway.jpg` et `start-zone.webp` sont les décors ; les sons WAV sont dans `sounds/`, et `sparks.json` est l'animation Lottie des gains. Remplacez un fichier par une illustration ou un son de même nom et format, puis rechargez. Les sprites fonctionnent mieux avec un fond transparent et une marge autour du sujet. Si les proportions diffèrent, ajustez leurs dimensions dans `components/pilot-chicken/GameScene.tsx`. Vérifiez les licences des nouveaux fichiers avant publication. Les effets sonores synthétiques sont propres à cette démo, sauf `cash.wav` : son crédit est dans `public/sounds/CREDITS.md`.

### Caisse commune fictive

Les opérations de Pilot Chicken et SkyJet passent par les routes serveur et un portefeuille PostgreSQL partagé (`DATABASE_URL`). Sans base disponible, les mises sont bloquées ; il n'y a pas de repli sur le calcul local. Les migrations `db/migrations/001...007` sont appliquées au premier accès sous verrou PostgreSQL. Les données de démonstration utilisent des tables `demo_*`. Les anciens soldes enregistrés seulement dans le navigateur ne sont pas transférés : un portefeuille fictif initial de 30 000 F est créé par session. Les soldes serveur préexistants des deux jeux sont additionnés lors de la migration 005 ; les mises en cours restent actives. Les portefeuilles historiques deviennent non modifiables pour empêcher les anciennes versions de débiter un solde périmé.

Les deux jeux utilisent le même portefeuille serveur, avec des transactions sérialisées et des réponses idempotentes. Aucune caisse maison ne limite les nouvelles mises, les traversées ou les gains ; seules les règles de mise et le solde du joueur restent applicables. Les mises SkyJet acceptées avant cette modification conservent leur plafond d’encaissement initial jusqu’à leur règlement, afin de respecter leurs conditions. Une case libre peut miser pendant le vol pour la manche suivante, sauf si cette case a déjà participé à la manche en cours. La mise est débitée immédiatement et peut être annulée avant le décollage. Les changements de mode sont programmés après les manches ayant déjà des mises. Le jeu auto est temporairement désactivé ; l’encaissement auto reste disponible. Les parties SkyJet expirées sont réglées lors de l’accès suivant à SkyJet.

Les sessions par cookie peuvent être recréées ; elles ne constituent pas une authentification fiable, et les résultats SkyJet restent publics et prévisibles. Ce système est exclusivement fictif : ni paiements ni retraits, pas de garantie de sécurité pour des fonds réels, et aucune mise en exploitation en argent réel sans conception, contrôle et audit indépendants.

Tests : `node --experimental-strip-types --test tests/treasury-risk.test.mjs`, `node --test tests/chicken-server.test.cjs`, et `TEST_DATABASE_URL=... node --test tests/treasury-postgres.test.cjs` avec une base PostgreSQL de test jetable. Ce dernier crée puis supprime son propre schéma et vérifie notamment deux mises concurrentes sur les deux jeux et le rollback de la mise refusée.

### Compte utilisateur
Un compte est obligatoire pour jouer aux deux jeux ; les API refusent les sessions invitées. Le menu « Mon compte » permet de créer un compte par identifiant et mot de passe. À l'inscription, le solde et les parties de la session invitée sont conservés ; se connecter depuis un autre appareil retrouve le même portefeuille. La connexion à un compte existant remplace la session invitée courante sans fusionner ses données : terminer ses parties invitées et créer un compte pour conserver ce solde avant de changer de compte. Les mots de passe sont hachés avec scrypt et les sessions utilisent des cookies HttpOnly. Les échecs répétés sont limités par identifiant. Il n'existe pas encore de récupération de mot de passe : sa perte empêche de retrouver le compte. Ce système fictif n'est pas adapté à l'argent réel.
