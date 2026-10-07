# LOME MARKETPLACE

## Lancer le site avec son API locale

```sh
npm start
```

`npm run dev` lance également ce même serveur. Ouvrez ensuite `http://127.0.0.1:8080` : cette adresse sert à la fois le site et toutes ses routes API. Si vous entrez par Live Server (`http://127.0.0.1:5500`), la page vous redirige vers le serveur unique. N’ouvrez pas directement `preview.html` via Live Server.

## Préparer le site Netlify

Le site public Netlify est statique ; il ne peut pas héberger directement le serveur `server.js` ni les fichiers de comptes stockés sur disque. Le fichier `netlify.toml` configure `npm run build:netlify` et publie uniquement `dist`, avec les routes des pages d’information et d’administration. Pour tester le paquet, lancez `npm run build:netlify`, puis déployez le contenu de `dist` dans Netlify ou connectez le dépôt au site `lomemarketplace`. Cela évite la redirection vers `127.0.0.1`, qui n’est accessible que depuis l’ordinateur du visiteur.

Le déploiement statique rend les pages accessibles, mais les routes `/api/*` (catalogue dynamique, comptes, administration, newsletter et paiements) nécessitent toujours le serveur Node et son stockage persistant. Elles ne deviennent pas disponibles sur Netlify avec ce seul paquet : il faut héberger l’API et sa base de données sur un service serveur, puis configurer l’URL d’API et la politique de cookies/origines avant d’ouvrir ces fonctions en production. Le paiement réel reste soumis à l’intégration du prestataire agréé.

- `GET /api/products?search=...` : recherche de produits par nom, vendeur ou ville
- `POST /api/auth/register` : création de compte (`name`, `email`, `password`, `accountType` optionnel : `buyer` ou `vendor`)
- `POST /api/auth/login` : connexion (`email`, `password`)
- `POST /api/auth/forgot-password` : demande de code de réinitialisation
- `POST /api/auth/reset-password` : réinitialisation (`email`, `token`, `password`)
- `GET /api/auth/me` : session courante
- `POST /api/auth/logout` : déconnexion
- `POST /api/newsletter/subscribe` : inscription ou désinscription (`email`, `action` : `subscribe` ou `unsubscribe`; l’inscription requiert `consent: true`)
- `GET /api/payments/config` : moyens mobiles prévus, commission et disponibilité du prestataire
- `GET /api/vendor/payment-settings` : coordonnées de reversement du vendeur connecté
- `PUT /api/vendor/payment-settings` : enregistrer les numéros TMoney/Flooz du vendeur (`tmoneyNumber`, `floozNumber`)
- `POST /api/payments/checkout` : point d’entrée protégé pour le futur paiement (retourne HTTP 503 tant que le prestataire n’est pas intégré)
- `GET /api/admin/status` : état de configuration administrateur
- `POST /api/admin/setup` : premier paramétrage local de l’administrateur
- `POST /api/admin/login` : connexion administrateur
- `GET /api/admin/dashboard` : tableau de bord (session administrateur requise)

Le lien **Connexion administrateur** se trouve dans le pied de page et ouvre `/admin/login`. Au premier lancement local, définissez le nom, l’adresse e-mail et un mot de passe administrateur (au moins 8 caractères, lettre et chiffre) sur cette page. Le mot de passe est stocké sous forme hachée dans `storage/admin.json`, fichier ignoré par Git. Pour un déploiement, créez l’accès avec les variables serveur `ADMIN_EMAIL` et `ADMIN_PASSWORD`; la création ouverte depuis la page est désactivée en mode `NODE_ENV=production`. Après cinq essais incorrects, la connexion est temporairement bloquée.

Le chemin `/verifie` est aussi redirigé vers la même page d’accueil sur le serveur Node. Pour tester séparément l’interface React/Vite, utilisez `npm run dev:react` ; ce mode est réservé au développement et n’est pas le serveur unique recommandé.

Les liens du pied de page ouvrent des pages dédiées d’information pour les acheteurs et les vendeurs, ainsi que les pages légales du prototype. Les coordonnées de contact affichées sont le `+228 98 20 31 13` et `faglagbodja67@gmail.com`. La newsletter exige un consentement explicite ; ses adresses sont enregistrées dans `storage/newsletter.json` (ignoré par Git), et le formulaire permet de se désinscrire avec la même adresse. Aucun e-mail n’est envoyé pour l’instant : un service d’envoi devra être configuré pour diffuser les actualités. Les photos des produits sont fournies par le catalogue ; les catégories, boutiques, créations « Made in Togo » et pages d’information ont également des emplacements illustrés. La page Centre vendeur propose six champs de prévisualisation d’images (5 Mo maximum par fichier). Les images sont uniquement affichées dans le navigateur : aucun téléversement, stockage serveur ou publication d’article n’est activé.

Le parcours paiement est préparé pour TMoney et Flooz : chaque vendeur connecté peut renseigner ses numéros de reversement dans le Centre vendeur. Ces coordonnées sont conservées dans `storage/vendor-payment-settings.json` (ignoré par Git) et ne sont jamais envoyées à l’acheteur. La marketplace encaissera le paiement puis reversera au vendeur le montant net après une commission de 3,5 %, arrondie au FCFA le plus proche (par exemple, 350 FCFA sur 10 000 FCFA). Le tableau Recettes de l’administration ne compte que des paiements confirmés. Le prestataire marchand et ses identifiants n’étant pas encore configurés, la caisse reste volontairement désactivée et aucun paiement, reversement ou revenu fictif n’est enregistré. `storage/payment-ledger.json` est réservé aux écritures de paiement confirmées par le futur connecteur.

L’assistant de conversation, disponible depuis le bouton « Besoin d’aide ? », répond aux questions fréquentes du prototype et recherche des produits via `GET /api/products`. Il s’agit d’un assistant local à réponses prédéfinies, pas d’un service d’intelligence artificielle ni d’une messagerie reliée à un conseiller ; les échanges restent dans la page.

À l’inscription et à la réinitialisation, le mot de passe doit compter de 8 à 128 caractères et contenir au moins une lettre et un chiffre. En développement local, le code de réinitialisation temporaire (valable 15 minutes et à usage unique) est affiché dans le formulaire ; aucun e-mail n’est envoyé. En production, le serveur ne renvoie pas le code : il faut configurer un service d’e-mail avant d’activer la récupération de compte.

Les comptes de démonstration sont enregistrés dans `storage/users.json` (ignoré par Git). Les mots de passe sont hachés avec scrypt et la session est portée par un cookie HttpOnly. Ce stockage JSON convient au prototype local ; une base de données et une configuration de cookie HTTPS sont nécessaires avant une mise en production.
