SUD AGRO MÉTÉO — INDICATEURS AGROCLIMATIQUES
================================================

FICHIERS
--------
- index.html
- style.css
- app.js
- logo-sudexpe.jpg

ONGLETS
-------
1. Vue d’ensemble
2. Prévisions météo
3. Déficit climatique
4. DPV
5. Indice de contrainte
6. Méthodes

PRÉVISIONS MÉTÉO
----------------
Prévisions sur 7 jours pour la position sélectionnée :
- températures minimales et maximales ;
- pluie ;
- humidité relative moyenne ;
- vent moyen et maximal.

DPV
---
- 0 à 0,8 kPa : faible demande atmosphérique ;
- 0,8 à 1,6 kPa : conditions favorables ;
- 1,6 à 2,5 kPa : début de régulation stomatique ;
- 2,5 à 3,5 kPa : contrainte atmosphérique élevée ;
- 3,5 à 4,5 kPa : stress sévère ;
- > 4,5 kPa : stress extrême.

DÉFICIT CLIMATIQUE
------------------
Calcul : ET0 - pluie, cumulé sur la période sélectionnée. Le bilan peut être négatif.

GITHUB PAGES
------------
Déposer les quatre fichiers web et le logo à la racine du dépôt, puis activer :
Settings > Pages > Deploy from a branch > main > root.

NOTE
----
L’indice de contrainte et les heures de conditions favorables sont des indicateurs d’aide à l’interprétation. Ils ne constituent pas des modèles scientifiques validés.


MISE À JOUR VUE D’ENSEMBLE ET MÉTÉO
----------------------------------
- Vue d’ensemble : Prévision aujourd’hui, ET0 aujourd’hui, DPV maximal aujourd’hui, Indice de contrainte aujourd’hui.
- Graphique de l’indice de contrainte limité aux 3 prochains jours.
- DPV horaire conservé sur 48 heures.
- Cartes météo quotidiennes conservées sur 7 jours.
- Graphiques météo désormais horaires : température, pluie, humidité relative et vent.
- Méthodes limitées à Prévisions météo, Déficit climatique, DPV et Indice de contrainte.
- L’avertissement méthodologique concerne uniquement l’indice de contrainte.


MISE À JOUR INDICE ET AXES TEMPORELS
------------------------------------
- Indice de contrainte : 40 % intensité DPV (moyenne des 3 heures les plus élevées), 30 % durée DPV > 2,5 kPa, 20 % durée > 35 °C, 10 % ET0.
- Sous-score chaleur : 0 h = 0 ; 1–2 h = 25 ; 3–5 h = 50 ; 6–8 h = 75 ; > 8 h = 100.
- Les courbes horaires conservent les données heure par heure mais l’axe X n’affiche que les changements de jour.
- La pluie prévisionnelle est affichée en histogramme journalier.


VERSION MOBILE / INSTALLABLE (PWA)
----------------------------------
Cette version peut être installée depuis GitHub Pages comme une application.
- Android / Chrome : utiliser le bouton « Installer l’application » ou le menu du navigateur.
- iPhone / Safari : Partager > Sur l’écran d’accueil.
- La navigation devient une barre tactile en bas de l’écran sur mobile.
- Les cartes météo et les cartes de l’indice se parcourent horizontalement.
- Les fichiers statiques sont mis en cache par un service worker. Une connexion Internet reste nécessaire pour actualiser les données météo.

Fichiers PWA supplémentaires : manifest.webmanifest, service-worker.js, icon-192.png, icon-512.png, apple-touch-icon.png.


MISE À JOUR MOBILE V2
---------------------
- Prévisions météo : choix de 3, 5 ou 7 jours.
- Indice de contrainte : choix de 3, 5 ou 7 jours.
- Sur tous les graphiques, les dates de l’axe X sont affichées sous la forme JJ/MM, sans nom du jour.
- Les cartes météo conservent leur libellé de jour détaillé.
