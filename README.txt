INDICATEURS AGROCLIMATIQUES V2
==============================

FICHIERS
--------
- index.html
- style.css
- app.js

FONCTIONNALITÉS
---------------
- géolocalisation automatique ou coordonnées manuelles ;
- DPV horaire avec bandes colorées ;
- heures cumulées > 1,5 / 2,5 / 3,5 / 4,5 kPa ;
- charge DPV cumulée en kPa·h ;
- indice de contrainte climatique journalier de 0 à 100 ;
- fenêtre prévisionnelle d’irrigation ;
- heures > 35 °C ;
- nuits tropicales ;
- heures potentiellement favorables à la photosynthèse ;
- humectation foliaire estimée ;
- ET0 et déficit climatique historique.

INDICE DE CONTRAINTE JOURNALIER
------------------------------
Score prototype :
- 40 % : DPV maximal journalier ;
- 25 % : durée avec DPV > 2,5 kPa ;
- 20 % : température maximale ;
- 15 % : ET0 journalière.

Classes :
- 0 à 24 : faible ;
- 25 à 49 : modérée ;
- 50 à 74 : élevée ;
- 75 à 89 : sévère ;
- 90 à 100 : extrême.

SEUILS DPV
----------
- 0 à 1,0 kPa : faible demande atmosphérique ;
- 1,0 à 1,5 kPa : conditions favorables ;
- 1,5 à 2,5 kPa : début de régulation stomatique ;
- 2,5 à 3,5 kPa : contrainte atmosphérique élevée ;
- 3,5 à 4,5 kPa : stress sévère ;
- > 4,5 kPa : stress extrême.

GITHUB PAGES
------------
Déposer index.html, style.css et app.js à la racine du dépôt.
Puis : Settings > Pages > Deploy from a branch > main > root.

IMPORTANT
---------
L’indice de contrainte, la fenêtre d’irrigation, l’humectation estimée et les heures
favorables sont des règles de prototype. Elles doivent être validées par SudExpé
avant utilisation opérationnelle ou diffusion comme conseil agronomique.
