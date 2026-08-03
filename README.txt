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
- indice de contrainte climatique journalier de 0 à 100 ;
- fenêtre d’irrigation par créneaux de 3 h pour le lendemain ;
- heures > 35 °C ;
- nuits tropicales ;
- heures potentiellement favorables à la photosynthèse ;
- heures humides estimées ;
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

MISE À JOUR V2.2
----------------
- Les deux graphiques DPV conservent les bandes colorées.
- La légende des bandes est affichée sous les graphiques, hors de la zone de tracé.
- Tous les autres graphiques utilisent un fond blanc gradué, sans bandes DPV.
- Les graphiques de l’indice climatique utilisent à nouveau une couleur selon le niveau de l’indice.

CORRECTION V2.3
---------------
Le plugin de légende DPV interne a été supprimé.
Les bandes DPV sont désactivées par défaut et activées uniquement sur :
- le graphique DPV de la vue d’ensemble ;
- le graphique DPV détaillé.
Tous les autres graphiques restent sur fond blanc gradué.

MISE À JOUR V2.5
----------------
Suppression de la section « Lecture des bandes de DPV » sans modifier les autres fonctions JavaScript.
